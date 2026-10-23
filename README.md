# RC5 CipherLab

An interactive RC5 encryption, configuration analysis and benchmarking platform. It runs entirely in
the browser: there is no server, no database, and no account, so plaintext and keys never leave the
tab.

**It is a measurement and learning tool, not a security-certification tool.** Nothing in it
establishes that an RC5 configuration is suitable for protecting real data.

---

## What it does

| Section | What it is for |
|---|---|
| Overview | What the tool measures, and the three steps that produce a comparison |
| Learn RC5 | The cipher, its notation, and a live round-by-round trace of the actual implementation |
| Simulator | Configure RC5, encrypt text or hex, verify the result by decrypting it, then time that configuration |
| Compare | Encryption and decryption time per configuration, with what each configuration is |
| Method | How each number is produced, and what it cannot support |

Five presets are offered — `RC5-32/12/16`, `RC5-32/16/16`, `RC5-32/20/16`, `RC5-16/12/16` and
`RC5-64/12/16` — as comparison points, never as recommendations.

A measurement is one configuration at one message size: a warm-up, then 150 samples of batched
operations, reported as a median with p95 and a spread. Measuring the same configuration again
replaces its row rather than adding a duplicate.

## Running it

```bash
pnpm install
pnpm dev        # development server
pnpm test       # test suite
pnpm build      # typecheck and production build
pnpm lint       # lint
pnpm preview    # serve the production build
```

Node 20 or newer. The project uses pnpm; `corepack enable pnpm` will provide it if it is missing.

## How correctness is established

Correctness comes from tests, not from a demonstration that appeared to work. `pnpm test` runs the
full reference vector set from RFC 2040 §9.2 and §9.3 — 29 vectors covering round counts from 0 to 16
and key lengths from 1 to 16 bytes — together with:

- agreement between two independently written implementations (a 32-bit integer path and a
  width-generic arbitrary-precision path), asserted across 90 configurations;
- round trips covering all three word sizes, six round counts and five key lengths, for payload
  lengths from zero bytes to a kilobyte;
- rotation at its boundaries, where the classic RC5 implementation bugs live;
- every way malformed padding, malformed hex, a wrong key length and an unsupported parameter can be
  rejected;
- the statistical definitions, against hand-computed sample arrays.

The 64-bit word size has no published reference vectors, because RFC 2040's test set covers only
32-bit words. Its correctness rests on the agreement and round-trip tests. Its timings are marked as
not comparable, because the arbitrary-precision arithmetic path costs far more than the integer path.

## How timing works, in one paragraph

A browser coarsens `performance.now()` as a side-channel mitigation, so a single block operation is
not resolvable. The runner grows a batch of operations until one batch spans at least 1 ms, then
divides each sample by the batch size, and reports the batch size alongside the results. Warm-up
iterations are discarded, and the key schedule is excluded from the timed region and reported
separately, so the per-operation figures are the cipher and nothing else. Browsers coarsen the clock
further when a page is not cross-origin isolated (commonly to 100 µs per step), which is why the
measured resolution is printed with every result.

## Layout

```
src/
  lib/
    rc5/          the cipher: word arithmetic, key schedule, block cipher, padding, validation
    benchmark/    statistics, payload generation, the runner, worker protocol
    measurement   the record one measurement produces, and its CSV form
  workers/        the measurement worker
  state/          zustand stores: settings, measurements, live measurement state
  components/     design system: shell, primitives, charts
  features/       one directory per section
  routes/         one thin page per section
```

`lib/` has no dependency on React or the DOM, which is what makes the cipher and the benchmark
methodology testable in isolation.

## What is never stored

Secret keys, plaintext, and derived round keys. They live in component state for as long as the
Simulator is open. Stored measurements contain the configuration, the message size, the statistics and
the environment only, and the measurement derives its own key from a fixed seed rather than using
yours.

## Further reading

`docs/methodology.md` and `docs/security-notes.md` summarise the timing method and the security
positioning. The application's own Method page is the fuller account.
