# Methodology

The full account lives in the application, under **08 Methodology**. This file is a summary for
readers of the repository.

## What a run does

1. Validate the specification: word size, round count, key length, payload size, iteration counts.
2. Generate the payload from the recorded pattern and seed, and allocate the input and output buffers
   once, before timing.
3. Expand the key schedule. In **steady-state** mode this happens before the timed region and is also
   timed separately as its own figure. In **cipher-call** mode it is inside every timed operation.
4. Run the configured warm-up iterations and discard all of them.
5. Measure the configured number of samples. Each sample is a batch of operations timed as a unit,
   divided by the number of operations in the batch.
6. Verify correctness after the timed region by running the output back through the opposite direction
   and comparing bytes. A mismatch is reported, not saved as a success.
7. Record the environment, the measured timer resolution, the chosen batch size, and any warnings.

## Why batching

Browsers coarsen `performance.now()` as a side-channel mitigation. A single RC5 block operation
finishes inside one timer step, so timing one operation reports zero. The runner doubles the batch size
until one batch spans at least 1 ms, then divides. Every result reports the batch size it used, so the
method is visible in the output rather than implied.

The measured resolution is reported with every run. When a page is not cross-origin isolated the clock
is commonly coarsened to 100 µs per step; batching compensates, and the resolution is stated so the
limitation is disclosed rather than hidden.

## What is inside the timed region

| Included | Excluded |
|---|---|
| Byte-to-word loading and word-to-byte storing | Payload generation |
| The round processing | Buffer allocation |
| The key schedule, in cipher-call mode only | Padding |
| | The correctness check |
| | All interface work (the run happens in a worker) |

The payload buffer is reused for every operation, so it stays cache-resident. That is a deliberate
choice and it is stated: these figures describe throughput under ideal memory conditions.

## Statistics

Let `n` be the number of samples, each a per-operation latency in nanoseconds.

| Statistic | Definition |
|---|---|
| Mean | Arithmetic mean |
| Median | Middle value; for even `n`, the mean of the two middle values |
| Standard deviation | Sample standard deviation, `n − 1` denominator |
| Q1, Q3 | Nearest-rank 25th and 75th percentiles |
| p95 | Nearest rank: the sample at position `⌈0.95 · n⌉` ascending. Flagged unreliable below `n = 30` |
| CV | Standard deviation ÷ mean, as a percentage |
| Throughput | Bytes processed ÷ elapsed seconds, where the byte count is the number of whole blocks |

## Warnings that can accompany a result

| Code | Meaning |
|---|---|
| `noisy` | CV above 25% — other work on the machine probably interfered |
| `few-samples` | Fewer than 30 samples, so p95 and the spread are weak |
| `high-load` | The fastest sample was far below the median, suggesting contention |
| `coarse-timer` | The reported timer step is 50 µs or larger |
| `max-batch-reached` | A batch at the size limit was still shorter than the target duration |
| `bigint-path` | 64-bit words, whose arithmetic is not comparable with the integer path |
| `cross-origin-isolated` | The page is not isolated, so the clock is likely coarsened |
| `large-workload` | More than 4 GiB processed in one run, so thermal effects are plausible |

## Comparability

Two results are only ranked against each other when payload size, direction, methodology and
arithmetic path all match. The Compare page groups results by that signature, ranks the largest
compatible group, and shows everything else with its absolute values and the reason it was excluded.

Interpretation sentences are produced by a pure function that compares a difference against the
variation the runs showed on their own. When the difference is not larger than the noise, the
application says so instead of naming a winner.

## Reproducing a run

Every saved run records the payload pattern and seed, the payload digest (FNV-1a), the iteration
counts, the batch size, the methodology and the environment. The payload digest is the check: two runs
that report the same digest processed the same bytes. The raw per-operation samples are exportable as
CSV.
