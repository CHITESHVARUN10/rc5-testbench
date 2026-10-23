# Security notes

This application is a measurement and learning tool. It is not a security-certification tool, and
nothing in it should be read as a recommendation to use RC5 for anything.

## The position, in short

RC5 is a legacy cipher. Its parameterisation does not make it flexible in the useful sense: the same
freedom that lets you choose a word size and a round count also lets you choose a weak configuration,
and the application cannot tell you which one you have.

Four kinds of statement are kept apart everywhere in the interface:

1. **Measured performance.** Empirical latency and throughput, with a sample count and a spread.
2. **Configuration facts.** Word size, rounds, key length, block size, padding policy. Facts about a
   choice, not judgements about it.
3. **Security context.** Documented caveats and known limitations. Nothing here is derived from a
   timing.
4. **Deployment context.** Mode of operation, integrity protection, key management, threat model and
   implementation review. All of it out of scope for this tool, and stated as such.

## What the application refuses to do

- It does not display a "secure" verdict for any configuration, based on rounds, key length or speed.
- It does not compute a numerical security score. No defensible methodology for one was available, so
  inventing a percentage would have been worse than having none.
- It does not compare times across different message sizes without stating the size, and it marks
  64-bit timings as not comparable with 32-bit ones, because their arithmetic paths differ.
- It does not store, log, export or place in a URL any plaintext, secret key or derived round key. The
  round key table is never displayed at all.

## What the literature says

The cipher was published in 1994 and the surrounding cryptanalysis developed quickly. RFC 2040 §10,
written in 1996 with reference to early results, suggested twelve rounds for the 64-bit block version
and sixteen for the 128-bit version. That is a historical statement, not current advice. Later
published work reached reduced-round configurations and, for particular parameters and attack models,
full twelve-round ones.

Round counts, plaintext requirements and attacker resources differ between those papers, and their
results are not interchangeable with a recommendation. The papers are listed under
**02 Learn RC5 → Glossary and sources** in the application. Read them in the original if the
distinction matters to your work.

## What a complete system would need

A block cipher is one component. A system that protects data needs, at least:

- a mode of operation chosen for the threat model — ECB is not one, because identical plaintext blocks
  produce identical ciphertext blocks;
- integrity protection, such as a message authentication code or an authenticated encryption mode;
- safe handling of any value that must never repeat, such as an IV or nonce;
- key management across the lifetime of keys, including rotation and revocation;
- a review of the implementation itself, including its handling of padding and errors.

None of that is provided here, and a benchmark cannot address any of it. For new work on data that
matters, the ordinary recommendation is a modern authenticated encryption scheme that has been reviewed
as a complete construction.

## Padding, specifically

This implementation offers PKCS#7 padding and a raw-block mode. Padding is framing: it makes the final
block whole and nothing else. It provides no integrity, it detects no tampering, and a decryption that
succeeds proves only that the padding was well formed. An error while removing padding is evidence that
*either* the key or the configuration is wrong *or* the bytes were altered — the interface says so
rather than guessing which.

## Reporting

If you find a problem with the implementation — a vector that fails, an arithmetic error, an
inconsistency between two word sizes — that is a correctness bug and worth fixing. The test suite is
where it should be caught: `pnpm test`.
