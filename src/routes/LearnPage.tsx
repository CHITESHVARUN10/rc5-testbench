import { blockSizeBytes, MAX_KEY_BYTES, MAX_ROUNDS } from '@/lib/rc5/constants'
import { useSettings } from '@/state/settings.store'
import { PageHeader } from '@/components/shell/PageHeader'
import { useSpecItems } from '@/components/shell/specs'
import { Badge, DataTable } from '@/components/ui/Data'
import { Notice } from '@/components/ui/Feedback'
import { Rule, Stack, StackHead, StackRow, Well } from '@/components/ui/Surface'
import { Hint, Label, Meta, Prose } from '@/components/ui/Text'
import { RoundDiagram } from '@/features/learn/RoundDiagram'

/**
 * Learn RC5.
 *
 * Written as a reference article rather than a walkthrough. The rule followed throughout: every
 * statement is either a definition, a fact taken from the specification, or attributed to a source.
 * There is no encouragement, no reassurance and no claim about suitability, because the cipher's own
 * literature does not support one.
 */

const SECTIONS: readonly { id: string; title: string }[] = [
  { id: 'what', title: 'What RC5 is' },
  { id: 'notation', title: 'Notation and parameters' },
  { id: 'operations', title: 'The three operations' },
  { id: 'round', title: 'One round, step by step' },
  { id: 'key', title: 'Key expansion' },
  { id: 'blocks', title: 'Blocks, padding and modes' },
  { id: 'rounds', title: 'What rounds cost, and what they buy' },
  { id: 'performance', title: 'Performance is not security' },
  { id: 'protocol', title: 'A cipher is not a protocol' },
  { id: 'glossary', title: 'Glossary and sources' },
]

export function LearnPage() {
  const specs = useSpecItems()

  return (
    <div className="space-y-12">
      <PageHeader
        index="02"
        category="Reference"
        title="Learn RC5"
        lead="RC5 is a symmetric block cipher published by Ronald Rivest in 1994. It is small enough to hold in your head, which is exactly why it is worth studying, and old enough that its limitations are documented rather than theoretical."
        specs={specs}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
        <article className="min-w-0 space-y-10">
          <section id="what" className="space-y-4">
            <StackHead index="02.1" title="What RC5 is" />
            <Prose>
              <p>
                A symmetric cipher uses the same secret key to encrypt and to decrypt. It takes a fixed
                number of bits at a time, called a <strong>block</strong>, and transforms them into
                another block of the same size under the control of the key. RC5 belongs to that family,
                and its distinguishing feature is that almost everything about it is a parameter: the
                size of the words it works on, the number of rounds it performs, and the length of the
                key are all chosen by whoever uses it.
              </p>
              <p>
                That parameterisation is the reason RC5 is useful for teaching. A reader can change one
                parameter and watch what happens, which is what the Simulator in this tool is for.
                It is also the reason RC5 needs care: the same freedom that makes it instructive means a
                configuration can be chosen badly, and picking a large word size or a long key does not
                by itself produce a strong cipher.
              </p>
              <p>
                RC5 is specified in RFC 2040, which describes the cipher itself along with the CBC and
                CBC-Pad modes built on it. The original description is Rivest's 1994 paper{' '}
                <em>The RC5 Encryption Algorithm</em>. Both are listed in the sources at the end of this
                page.
              </p>
            </Prose>
          </section>

          <section id="notation" className="space-y-4">
            <StackHead index="02.2" title="Notation and parameters" />
            <Prose>
              <p>
                An RC5 configuration is written <strong>RC5-w/r/b</strong>, and the three letters are
                the three parameters. Every RC5 result in this application is labelled that way, because
                a timing or a ciphertext without them is uninterpretable.
              </p>
            </Prose>

            <ParameterNotation />

            <Prose>
              <p>
                The block size is not a free parameter: it is exactly twice the word size, because a
                block is processed as two words. A 16-bit configuration therefore has a 32-bit block,
                which is small by modern standards and is one reason the RFC itself remarks that block
                sizes below 64 bits are academically interesting but should not be used for security
                (RFC 2040 §10).
              </p>
              <p>
                This tool offers word sizes of 16, 32 and 64 bits, rounds from 1 to {MAX_ROUNDS}, and key
                lengths from 1 to {MAX_KEY_BYTES} bytes. Those are the ranges the implementation has been
                tested against, not the ranges the algorithm permits; the RFC allows r = 0, which is used
                in its own test vectors to isolate the key schedule, and this engine accepts it even
                though the interface does not offer it.
              </p>
            </Prose>
          </section>

          <section id="operations" className="space-y-4">
            <StackHead index="02.3" title="The three operations" />
            <Prose>
              <p>
                RC5 is built from three operations on fixed-width words, and nothing else. There is no
                substitution table and no lookup of any kind.
              </p>
              <ul>
                <li>
                  <strong>Exclusive or (⊕)</strong> combines two words bit by bit: the result has a 1
                  where the two inputs differ and a 0 where they agree. It is its own inverse, which is
                  what lets decryption undo it without a separate operation.
                </li>
                <li>
                  <strong>Modular addition (+)</strong> adds two words and discards any carry beyond the
                  word width. At 32 bits, <span className="font-mono">0xFFFFFFFF + 1</span> is{' '}
                  <span className="font-mono">0x00000000</span>. Addition provides the diffusion: a carry
                  propagates across the word, so a change in one bit can affect many.
                </li>
                <li>
                  <strong>Circular rotation (&lt;&lt;&lt;)</strong> shifts the bits of a word and moves
                  the ones that fall off one end back into the other. Unlike a plain shift, no bits are
                  lost. Here is the part that makes RC5 distinctive: in this cipher the rotation{' '}
                  <em>amount</em> is not a fixed constant. It is taken from the other half of the block,
                  so the number of positions rotated depends on the data being processed. The RFC calls
                  the rotation amount a function of the data, and notes that only the low log₂(w) bits of
                  the amount matter (RFC 2040 §6.2).
                </li>
              </ul>
              <p>
                Data-dependent rotation is RC5's contribution, and it is also what makes the cipher
                awkward to analyse: the operation is not linear over the bits, so the usual algebra of
                linear and differential cryptanalysis does not apply directly.
              </p>
            </Prose>
          </section>

          <section id="round" className="space-y-4">
            <StackHead index="02.4" title="One round, step by step" />
            <Prose>
              <p>
                Encryption begins by adding two words of the expanded key, S[0] and S[1], to the two
                halves of the block. Then it repeats the following round r times, using two more words of
                the expanded key each time:
              </p>
              <ul>
                <li>
                  <span className="font-mono">A = ((A ⊕ B) &lt;&lt;&lt; B) + S[2i]</span>
                </li>
                <li>
                  <span className="font-mono">B = ((B ⊕ A) &lt;&lt;&lt; A) + S[2i+1]</span>
                </li>
              </ul>
              <p>
                Both lines do the same thing with the roles swapped, and each uses the value it just
                produced. Decryption runs the same structure backwards, subtracting the round key before
                undoing the rotation and the XOR.
              </p>
              <p>
                The diagram below is not an illustration of that formula with letters standing in for
                numbers. It is the engine's own output: step through it and each box shows the value the
                implementation actually produced at that point.
              </p>
            </Prose>

            <RoundDiagram />

            <Hint>
              Change the configuration in the strip above and this trace follows it, including the round
              count. The demonstration block and key are fixed so that the numbers stay comparable while
              you read.
            </Hint>
          </section>

          <section id="key" className="space-y-4">
            <StackHead index="02.5" title="Key expansion" />
            <Prose>
              <p>
                A round needs two words of key material, so the secret key is first expanded into a table
                of {`2(r + 1)`} words called S. The process has three steps (RFC 2040 §5.3 to §5.5).
              </p>
              <ul>
                <li>
                  The key bytes are copied into an array of words, L, in little-endian order. A key that
                  is shorter than one word does not fill it, and the remaining bytes are zero.
                </li>
                <li>
                  S is filled with a fixed arithmetic progression independent of the key: S[0] is the
                  constant P_w and each subsequent word is the previous one plus Q_w, both reduced modulo
                  2^w. P_w and Q_w are derived from the base of the natural logarithm and the golden
                  ratio, rounded to the nearest odd integer. At 32 bits, P is{' '}
                  <span className="font-mono">0xB7E15163</span> and Q is{' '}
                  <span className="font-mono">0x9E3779B9</span>.
                </li>
                <li>
                  The key is then mixed in: A, B and both indices start at zero, and a loop runs{' '}
                  {`3 × max(t, c)`} times, where t is the length of S and c the length of L. Each
                  iteration rotates a word of S left by three and a word of L left by an amount taken
                  from the running sums, so that every bit of the key affects every word of the round
                  keys.
                </li>
              </ul>
              <p>
                Two practical consequences. First, key expansion is not free: it costs about as much as
                encrypting a short message, which is why the measurement step times it separately. Second, the
                expansion is deterministic and cannot be reversed, but the round keys are derived from
                the secret key, which is why this tool never displays or exports them.
              </p>
            </Prose>
          </section>

          <section id="blocks" className="space-y-4">
            <StackHead index="02.6" title="Blocks, padding and modes" />
            <Prose>
              <p>
                RC5 encrypts blocks of a fixed size, and a message is rarely an exact number of blocks.
                Something has to be done about the last one.
              </p>
              <p>
                <strong>Padding</strong> extends the final block to a full block. This tool implements
                PKCS#7, which is the same scheme RFC 2040 specifies for CBC-Pad: the padding is a
                sequence of bytes, each holding the number of bytes added. One byte is added if the
                message is one byte short of a boundary; a whole block is added if the message already
                ends on one. That last rule matters, because it makes the padding unambiguous to remove.
                Padding is framing. It is not a check, and it detects nothing.
              </p>
              <p>
                <strong>Mode</strong> is what turns a block cipher into something that can encrypt a
                message. Encrypting each block independently is called ECB, and in ECB identical
                plaintext blocks produce identical ciphertext blocks. Encrypt a picture in ECB and the
                outline is still visible. This tool demonstrates the primitive and the round trip; it
                does not implement a mode. If you want to see why the distinction matters, the standard
                demonstration is to encrypt an image with ECB and with CBC and compare, and RFC 2040
                specifies CBC and CBC-Pad for RC5 if you want to follow that up.
              </p>
            </Prose>
            <Notice tone="caution" title="Padding is not authentication">
              An attacker can alter ciphertext bytes without knowing the key. Padding does not detect
              that, and a decryption that succeeds says nothing about whether the message was modified in
              transit. Integrity needs a message authentication code or an authenticated encryption mode,
              which is a separate mechanism from the cipher.
            </Notice>
          </section>

          <section id="rounds" className="space-y-4">
            <StackHead index="02.7" title="What rounds cost, and what they buy" />
            <Prose>
              <p>
                Each round performs one rotation, two additions and three XORs on each half of the block,
                plus two reads from the round key table. Increasing r increases the work per block
                roughly in proportion, which is straightforward to measure and is what the latency
                against rounds chart in this tool shows.
              </p>
              <p>
                What additional rounds buy is less straightforward. More rounds increase the number of
                steps an attacker has to model, and the RFC, writing in 1996 with reference to early
                published results, suggested twelve rounds for the 64-bit block version and sixteen for
                the 128-bit version (RFC 2040 §10). That advice is a historical statement, not a current
                recommendation: subsequent published cryptanalysis reached reduced-round and, for
                particular parameter sets and attack models, full twelve-round configurations. The
                relevant literature is listed below, and it is worth reading in the original rather than
                in summary, because the exact round counts a particular attack reaches depend on the
                parameters, the number of plaintexts the attacker is assumed to obtain, and the computing
                resources assumed available.
              </p>
              <p>
                The honest summary is that the relationship between r and security is not a lookup table,
                and this tool will not invent one.
              </p>
            </Prose>
          </section>

          <section id="performance" className="space-y-4">
            <StackHead index="02.8" title="Performance is not security" />
            <Prose>
              <p>
                It is tempting to read a benchmark as a security result: a configuration that takes
                longer certainly does more work, and more work sounds like more protection. The
                inference does not hold.
              </p>
              <ul>
                <li>
                  Latency measures computation, not resistance. An attacker's cost is dominated by the
                  attack algorithm and the attacker's resources, not by how long the defender's
                  encryption takes.
                </li>
                <li>
                  Key length is one input to security and not a measure of it. A long key does not
                  compensate for too few rounds, and a key-search challenge being completed against a
                  short key says something about key length, not about the round function.
                </li>
                <li>
                  A measurement on this machine does not transfer. A browser benchmark cannot establish
                  how a microcontroller would perform, and it cannot establish how any device would
                  resist a particular attack.
                </li>
              </ul>
              <p>
                This is why this application separates four things that are easy to blend together:{' '}
                <strong>measured performance</strong>, <strong>configuration facts</strong>,{' '}
                <strong>security context</strong> and <strong>deployment context</strong>. The Compare
                page can tell you which configuration was quicker in a test. It cannot tell you which is
                safer, and it will not phrase a result as though it could.
              </p>
            </Prose>
          </section>

          <section id="protocol" className="space-y-4">
            <StackHead index="02.9" title="A cipher is not a protocol" />
            <Prose>
              <p>
                A block cipher is one component of a system. On its own it does not say how a message
                longer than a block is handled, how the two sides agree on a key, how the message's
                integrity is protected, whether a message can be replayed, or what happens when an
                attacker modifies a byte. Every one of those decisions is made elsewhere, and every one
                of them can undo a perfectly good cipher.
              </p>
              <p>
                A complete system needs a mode of operation chosen for the threat model, a way to protect
                integrity such as a message authentication code or an authenticated encryption mode, safe
                handling of the values that must never repeat, key management across the lifetimes of
                keys, and a review of the implementation itself. This tool covers the primitive. It is
                explicit that the rest is out of its scope, not because it is unimportant but because a
                measurement cannot address it.
              </p>
              <p>
                For new work on data that matters, the ordinary recommendation is to use a modern
                authenticated encryption scheme that has been reviewed as a complete construction, rather
                than assembling one from an older primitive.
              </p>
            </Prose>
          </section>

          <section id="glossary" className="space-y-4">
            <StackHead index="02.10" title="Glossary and sources" />
            <Glossary />
            <Sources />
          </section>
        </article>

        <nav aria-label="On this page" className="hidden lg:sticky lg:top-6 lg:block">
          <Label>On this page</Label>
          <ul className="mt-3 space-y-2">
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex gap-2 text-sm text-ink-3 transition-colors duration-150 ease-instrument hover:text-ink"
                >
                  <span className="font-mono text-label tabular-nums text-ink-4">
                    02.{index + 1}
                  </span>
                  <span>{section.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

/** The notation, broken out against whatever configuration is currently selected. */
function ParameterNotation() {
  const config = useSettings((state) => state.config)

  return (
    <Stack>
      <StackRow className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="font-mono text-xl text-ink">RC5</span>
          <span className="font-mono text-xl text-ink-4">-</span>
          <span className="font-mono text-xl text-signal-ink">{config.w}</span>
          <span className="font-mono text-xl text-ink-4">/</span>
          <span className="font-mono text-xl text-signal-ink">{config.r}</span>
          <span className="font-mono text-xl text-ink-4">/</span>
          <span className="font-mono text-xl text-signal-ink">{config.b}</span>
          <Badge tone="signal">current configuration</Badge>
        </div>

        <DataTable
          caption="The three parameters of the current configuration"
          rows={[
            {
              letter: 'w',
              name: 'Word size',
              value: `${config.w} bits`,
              meaning: `The size of each internal word. The rotation operates on a ${config.w}-bit boundary.`,
            },
            {
              letter: 'r',
              name: 'Rounds',
              value: String(config.r),
              meaning: 'How many times the round function is applied to the block.',
            },
            {
              letter: 'b',
              name: 'Key length',
              value: `${config.b} bytes`,
              meaning: `The secret key occupies ${config.b} bytes, which is ${config.b * 8} bits.`,
            },
            {
              letter: '—',
              name: 'Block size',
              value: `${blockSizeBytes(config.w)} bytes`,
              meaning: `Twice the word size, ${config.w * 2} bits. The block is processed as two words.`,
            },
          ]}
          getRowKey={(row) => row.letter}
          columns={[
            {
              key: 'letter',
              header: 'Parameter',
              render: (row) => <span className="font-mono text-ink">{row.letter}</span>,
            },
            { key: 'name', header: 'Name', render: (row) => <span className="text-ink-2">{row.name}</span> },
            {
              key: 'value',
              header: 'This configuration',
              render: (row) => <span className="font-mono text-ink">{row.value}</span>,
            },
            { key: 'meaning', header: 'What it means', render: (row) => <span className="text-ink-3">{row.meaning}</span> },
          ]}
        />
      </StackRow>
    </Stack>
  )
}

function Glossary() {
  const terms: readonly { term: string; definition: string }[] = [
    {
      term: 'Block cipher',
      definition:
        'A cipher that transforms a fixed-size block of bits into another block of the same size, under a key. It says nothing about how messages longer than one block are handled.',
    },
    {
      term: 'Symmetric key',
      definition:
        'A scheme where the same secret is used to encrypt and to decrypt. RC5 is symmetric; public-key ciphers are not.',
    },
    {
      term: 'Word',
      definition:
        'The unit of arithmetic in a cipher. RC5 works on words of 16, 32 or 64 bits and masks every operation to that width.',
    },
    {
      term: 'Data-dependent rotation',
      definition:
        "A rotation whose amount is taken from the data rather than from a constant. RC5's round uses the other half of the block as the amount.",
    },
    {
      term: 'Key schedule',
      definition:
        'The expansion of the secret key into the per-round key material. Also called key expansion.',
    },
    {
      term: 'Round',
      definition:
        'One repetition of the cipher\'s core transformation. RC5 applies two keyed operations per round, one to each half of the block.',
    },
    {
      term: 'Diffusion',
      definition:
        'The property that a change in one input bit affects many output bits. Modular addition provides most of the diffusion in RC5.',
    },
    {
      term: 'Differential cryptanalysis',
      definition:
        'An attack that studies how differences between inputs propagate to differences between outputs, and uses the non-uniformity it finds to recover key material.',
    },
    {
      term: 'Linear cryptanalysis',
      definition:
        'An attack that looks for linear approximations of the cipher that hold with a probability other than one half.',
    },
    {
      term: 'ECB',
      definition:
        'Electronic Codebook: encrypting each block independently. Identical plaintext blocks produce identical ciphertext blocks, which leaks structure.',
    },
    {
      term: 'CBC',
      definition:
        'Cipher Block Chaining: each plaintext block is combined with the previous ciphertext block before encryption, so identical blocks encrypt differently.',
    },
    {
      term: 'PKCS#7 padding',
      definition:
        'Filling the final block with bytes that each hold the number of bytes added. Always adds at least one byte.',
    },
    {
      term: 'IV / nonce',
      definition:
        'A value used once per message to make otherwise-identical messages encrypt differently. Reusing one where the mode forbids it can break the mode entirely.',
    },
    {
      term: 'Authenticated encryption',
      definition:
        'A construction that provides confidentiality and integrity together, so that a modified ciphertext is rejected rather than decrypted into something plausible.',
    },
    {
      term: 'Median',
      definition:
        'The middle value of a set of measurements. Used throughout this tool because it is not distorted by the outliers that a mean is.',
    },
    {
      term: 'p95',
      definition:
        'The nearest-rank 95th percentile: the sample at position ⌈0.95 · n⌉ in ascending order. At least 30 samples are needed for it to mean anything.',
    },
    {
      term: 'Coefficient of variation',
      definition:
        'The sample standard deviation divided by the mean. This tool uses it to decide whether a difference between two configurations is larger than the noise in the measurements.',
    },
  ]

  return (
    <Stack>
      {terms.map((entry) => (
        <StackRow key={entry.term} className="py-3">
          <dl className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
            <dt>
              <Label>{entry.term}</Label>
            </dt>
            <dd className="max-w-[68ch] text-sm text-ink-2">{entry.definition}</dd>
          </dl>
        </StackRow>
      ))}
    </Stack>
  )
}

function Sources() {
  return (
    <div className="space-y-4">
      <Well className="p-4">
        <ul className="space-y-3 text-sm text-ink-2">
          <li>
            R. L. Rivest, <em>The RC5 Encryption Algorithm</em>, Fast Software Encryption workshop, 1994.
            The original description of the cipher and its parameters.
          </li>
          <li>
            R. Baldwin and R. Rivest, <em>RFC 2040: The RC5, RC5-CBC, RC5-CBC-Pad, and RC5-CTS
            Algorithms</em>, October 1996. The specification this implementation follows, and the source
            of every reference vector in its test suite.
          </li>
          <li>
            B. Kaliski and Y. Yin, <em>On Differential and Linear Cryptanalysis of the RC5 Encryption
            Algorithm</em>, CRYPTO '95.
          </li>
          <li>
            L. Knudsen and W. Meier, <em>Improved Differential Attacks on RC5</em>, CRYPTO '96.
          </li>
          <li>
            A. Biryukov and E. Kushilevitz, <em>Improved Cryptanalysis of RC5</em>, EUROCRYPT '98.
          </li>
        </ul>
      </Well>
      <Hint>
        Round counts and attack models differ between the cryptanalysis papers, and their results are
        not interchangeable with a recommendation. Read them in the original if the distinction matters
        to your work. Nothing on this page is a substitute for that reading, and nothing in this tool is
        a security assessment of any configuration.
      </Hint>
      <Rule />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Meta>Implementation follows RFC 2040 §5 and §6</Meta>
        <Meta>Reference vectors transcribed from RFC 2040 §9.2 and §9.3</Meta>
      </div>
    </div>
  )
}
