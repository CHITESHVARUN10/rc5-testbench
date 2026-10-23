# Methodology

The in-application account lives under **05 Method**. This file summarises it for readers of the
repository.

## What one measurement does

1. A payload of the requested size is generated deterministically. The plaintext typed into the
   Simulator is never used for timing and never leaves the component.
2. The key is expanded once. The per-operation figures therefore exclude key setup; it is measured
   separately, over 200 expansions, after a warm-up pass of its own.
3. 100 warm-up operations run, then 150 samples are taken.
4. Each sample times a batch of operations and divides by the batch size. The batch grows until it
   spans at least 1 ms, because a browser coarsens `performance.now()` and cannot resolve a single
   operation.
5. The ciphertext is decrypted once and compared with the payload. A run that does not round-trip is
   reported as a mismatch, not as a speed.

## Inside and outside the timed region

Inside: byte-to-word loading, the round function, and word-to-byte storing.

Outside: payload generation, buffer allocation, padding, the correctness comparison, and the
interface. The same payload buffer is reused for every operation, so it stays in cache; these are
throughput figures under ideal memory conditions.

## Statistics

The reported figure is the median of the samples. p95 uses the nearest-rank definition, and the
coefficient of variation is the sample standard deviation over the mean. A spread much above a few
percent means the machine was doing something else, and the comparison table shows it rather than
hiding it.

## Limits

- The numbers describe one browser on one machine at one moment. Another machine, another browser, a
  busy processor or a thermal limit will move them.
- A timing says nothing about cryptographic strength. Published attacks on reduced-round RC5 are
  cryptanalysis, which no stopwatch can reproduce. The notes in Compare come from the specification
  and the literature; they are context, not a verdict.
- 64-bit words are computed with arbitrary-precision integers in this implementation, so their
  timings are not comparable with the 16- and 32-bit paths.

## Correctness

`pnpm test` runs the reference vector set from RFC 2040 §9.2 and §9.3 (29 vectors), agreement between
two independently written arithmetic paths, round-trip coverage across word sizes and key lengths, the
rotation boundaries, and the rejection paths for malformed input. See the repository README.
