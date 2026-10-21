# PRD.md — RC5 CipherLab
## Interactive RC5 Encryption, Configuration Analysis, and Benchmarking Platform

**Project name:** RC5 CipherLab  
**Formal project title:** Design and Development of an RC5 Cryptographic Analysis and Benchmarking System  
**Document type:** Product Requirements Document (PRD)  
**Version:** 1.0  
**Status:** Implementation-ready baseline  
**Primary purpose:** Educational, experimental, and academic analysis of the RC5 block cipher

---

## 1. Product Overview

RC5 CipherLab is a web application that lets users learn about the RC5 block cipher, configure its parameters, encrypt and decrypt sample data, benchmark execution performance, compare configurations, and explore the trade-offs among speed, computational cost, memory usage, and security considerations.

The system should do more than produce ciphertext. It should help users answer questions such as:

- What changes when the number of RC5 rounds is increased?
- How do word size and secret-key length affect performance?
- How long does encryption take for different payload sizes?
- What is the measured throughput under a given test environment?
- Which configuration is faster under a defined workload?
- What are the limits of drawing security conclusions from performance measurements?
- Would the measured encryption time fit a user-defined latency budget for an illustrative IoT workload?
- How much time might be spent encrypting, transmitting, and decrypting a message under stated assumptions?
- Which configuration is a reasonable *experimental candidate* for a scenario, and what additional security review would be required?

The platform is intended for coursework, demonstrations, reproducible experiments, and algorithm analysis. It must clearly state that RC5 is a legacy cipher and that speed measurements do not establish that a configuration is secure for modern production use. It must not market any RC5 configuration as suitable for sensitive real-world data solely because it is fast or passes a timing target.

## 2. Problem Statement

Students and developers often find cryptographic algorithms difficult to compare because their parameters, mathematical operations, and performance results are presented separately. A user may understand that more rounds generally mean more computation, but still lack an interactive way to test the effect on different input sizes and machines.

RC5 CipherLab will bring together:

1. A concise educational introduction to RC5.
2. An interactive configuration and encryption/decryption simulator.
3. A repeatable benchmarking engine.
4. Configuration comparison tables and visualizations.
5. Scenario-based analysis, including illustrative IoT latency budgets.
6. A saved experiment history and exportable report.

The result should be a visually polished and technically defensible academic software project.

## 3. Goals and Success Criteria

### 3.1 Product goals

- Explain RC5 concepts in accessible language without oversimplifying its security limitations.
- Allow users to configure supported RC5 parameters explicitly.
- Produce correct encryption and decryption results for known test vectors.
- Measure performance with repeatable methodology and disclose the test environment.
- Compare configurations using consistent workloads.
- Help users reason about compute time, payload size, estimated transmission time, and latency budgets.
- Provide an evidence-based report that can be used in a project demonstration or academic submission.

### 3.2 Success criteria

The project is considered ready for demonstration when:

- Correctness tests pass for published/reference vectors and round-trip tests.
- A user can encrypt and decrypt supported text or hexadecimal input.
- A user can run a benchmark for a chosen configuration and payload size.
- A user can compare at least three configurations under the same workload.
- Results include timing methodology, units, payload size, iteration count, and environment details.
- Charts and tables update from actual benchmark results rather than hard-coded demo values.
- The user can save an experiment and export a report.
- The application distinguishes measured encryption time from estimated network and end-to-end time.
- The interface makes no unsupported claim that a particular RC5 configuration is secure or production-ready.

## 4. Target Users

### 4.1 Student / researcher
Wants to understand RC5, experiment with parameters, gather results, and prepare a project report.

### 4.2 Developer / evaluator
Wants to compare implementation performance, inspect reproducibility details, and validate results.

### 4.3 IoT / embedded-systems learner
Wants to explore how payload size, measured computation time, bandwidth assumptions, and a latency budget affect a hypothetical data-transfer scenario.

## 5. Scope

### 5.1 In scope for the MVP

- Educational RC5 overview and glossary.
- Supported parameter selection.
- Text and hexadecimal input modes.
- Encryption and decryption.
- Input validation and clear error handling.
- Configurable benchmark runs.
- Multiple payload sizes and repeated iterations.
- Mean, median, minimum, maximum, standard deviation, and p95 timing where the sample size supports it.
- Throughput calculations with clearly defined units.
- Configuration comparison.
- Charts and results tables.
- Scenario calculator with explicit assumptions.
- Experiment history.
- Export results to CSV and a downloadable Markdown or PDF report if PDF export is implemented.
- Unit tests, correctness tests, and a reproducibility section.
- Responsive interface and accessibility basics.

### 5.2 Later / optional enhancements

- Web Worker-based benchmarking to keep the UI responsive.
- Import/export experiment configuration as JSON.
- Benchmark presets for common RC5 profiles.
- Side-by-side comparisons of local and server-side implementations.
- Optional hardware testing through a separately documented native/embedded client.
- User accounts and cloud-synced experiment history.
- A carefully designed extension to compare RC5 with modern algorithms for educational purposes. This must be a separate comparison module and must not imply equivalent security.

### 5.3 Out of scope

- Claiming to prove that a configuration is secure.
- Cracking, attacking, or recovering keys from third-party systems.
- Recommending RC5 for protecting sensitive production data.
- Claiming that browser benchmarks represent every IoT device or hardware platform.
- Measuring physical power consumption without actual power-measurement hardware.
- Treating a simulated resource estimate as a real hardware measurement.
- Building a general-purpose key-management service.
- Storing user secret keys or plaintext unnecessarily.

## 6. RC5 Educational Module

The first section of the application should explain the algorithm before users enter the simulator.

### 6.1 What is RC5?

RC5 is a symmetric-key block cipher designed by Ronald L. Rivest and published in the 1990s. A symmetric cipher uses the same secret key for encryption and decryption. RC5 is notable for its parameterized design and use of data-dependent rotations.

Its name is commonly written as:

**RC5-w/r/b**

Where:

- **w — word size:** Size of each internal word, in bits.
- **r — number of rounds:** Number of main processing rounds.
- **b — secret-key length:** Key length, in bytes.

The block size is **2 × w bits**, because a block is processed as two w-bit words.

Example: **RC5-32/12/16** means a 32-bit word size, 12 rounds, and a 16-byte (128-bit) secret key. Its block size is 64 bits.

### 6.2 Important algorithm characteristics

- Parameterized word size, round count, and key length.
- Uses modular addition, XOR, and data-dependent circular rotations.
- Compact conceptual structure suitable for teaching and implementation experiments.
- The same secret key is used to encrypt and decrypt.
- Block-cipher operation requires a defined way to handle data that does not fill a complete block.

### 6.3 Security caveat

RC5 is a legacy algorithm. Its parameterization does not make every possible setting secure. Lower round counts can weaken resistance to cryptanalysis, while more rounds generally increase computational work. Key length alone does not establish security. Security also depends on the mode of operation, IV/nonce handling where relevant, padding, authentication, implementation quality, threat model, and key management.

The application must not display a simple “secure” verdict based only on rounds, key length, or benchmark speed. Instead, it should display transparent educational notes and classify evidence separately from performance.

### 6.4 Suggested educational content

- Symmetric versus asymmetric cryptography.
- Block ciphers versus stream ciphers.
- RC5 parameter notation.
- Block size and key length.
- XOR, modular addition, and circular rotation.
- Key expansion at a high level.
- Encryption and decryption flow.
- Why round count affects cost.
- Why performance does not equal security.
- Why authenticated encryption is important in modern systems.
- Difference between a cipher primitive and a complete secure communication protocol.

## 7. RC5 Configuration Model

### 7.1 Parameters

The configuration panel must make the three core RC5 parameters explicit:

| Parameter | Meaning | UI behavior |
|---|---|---|
| Word size (`w`) | Internal word size in bits | Select only word sizes implemented and tested by the engine |
| Rounds (`r`) | Number of rounds | Numeric input or slider within the engine's supported range |
| Key length (`b`) | Secret key length in bytes | Select or enter a valid length within the engine's supported range |

Do not expose a parameter range just because the original algorithm permits it. The UI must only permit values the current implementation can process correctly and safely.

### 7.2 Preset profiles

Provide editable educational presets. Presets are starting points for experiments, not security recommendations.

- **RC5-32/12/16:** 32-bit word, 12 rounds, 16-byte key.
- **RC5-32/16/16:** 32-bit word, 16 rounds, 16-byte key.
- **RC5-32/20/16:** 32-bit word, 20 rounds, 16-byte key.
- **Custom:** User selects supported values.

The interface must explain that these examples are for comparing configurations. It must not label any of them “secure for production.” The benchmark must record the exact parameters rather than only the preset name.

### 7.3 Input and key fields

The simulator must distinguish:

- **Plaintext input:** The message to encrypt.
- **Secret key:** The key material used by RC5.
- **Ciphertext output:** The encrypted bytes, commonly displayed as hexadecimal.
- **Decrypted output:** The recovered plaintext after decryption.

The phrase “output key” must not be used for the ciphertext. RC5 does not generate a new key as the encryption output.

Provide input modes:

- UTF-8 text.
- Hexadecimal bytes.

For the key, support a clearly labeled text-to-byte or hexadecimal-byte input mode. Display the resulting key length in bytes. Do not silently truncate or extend user-provided key material. If a selected RC5 key length is required, validation must explain how the provided key material relates to the configured byte length.

### 7.4 Block handling and padding

RC5 operates on fixed-size blocks of `2 × w` bits. Text input may not be an exact multiple of the block size.

The application must:
- Show the selected block size in bytes.
- Offer an explicitly named padding policy that is implemented and tested, such as PKCS#7 for block-aligned byte processing.
- Remove padding only during decryption when that padding policy is selected.
- Reject malformed ciphertext or invalid padding with a clear error.
- Never silently discard input bytes.
- Document that padding is not authentication and does not prevent tampering.

For a minimal first implementation, it is acceptable to support one tested padding policy plus an explicitly selected raw-block mode that rejects incomplete blocks. Do not silently add padding without informing the user.

### 7.5 Encryption and decryption workflow

1. User selects a preset or custom configuration.
2. User selects input format and enters plaintext or bytes.
3. User enters a secret key in the chosen key format.
4. UI validates parameters and lengths.
5. User clicks **Encrypt**.
6. The engine encrypts the input using the selected configuration and padding policy.
7. UI displays ciphertext, its encoding, byte length, and configuration.
8. User can copy or download the ciphertext.
9. User can use **Decrypt** to validate recovery of the original input.
10. UI displays whether the recovered bytes match the original bytes.

Never log plaintext or secret keys in ordinary application logs. Avoid persisting them in experiment history.

## 8. Benchmarking Engine

### 8.1 Purpose

The benchmark engine measures the implementation under a documented environment. Results should be repeatable enough for comparison but must acknowledge that measurements vary with CPU load, browser/runtime, JIT warm-up, operating system, and implementation details.

### 8.2 Benchmark inputs

Users should be able to configure:

- RC5 word size.
- Round count.
- Key length.
- Payload size or a set of payload sizes.
- Input pattern (generated deterministic bytes for benchmarks, or an explicitly selected sample input).
- Number of measured iterations.
- Warm-up iterations.
- Whether to benchmark encryption, decryption, or both.
- Whether to run one configuration or a comparison group.

Suggested payload presets: 16 B, 64 B, 256 B, 1 KiB, 4 KiB, 16 KiB, and 64 KiB, subject to implementation limits. These are test sizes, not promises about real application message sizes.

### 8.3 Benchmark procedure

For each configuration and payload size:

1. Validate parameters and workload limits.
2. Generate or prepare deterministic benchmark bytes.
3. Initialize the key schedule outside the timed region if measuring only block processing; if key setup is being studied, measure it separately.
4. Run warm-up iterations and exclude them from the primary result.
5. Run the configured number of measured iterations.
6. Use a monotonic high-resolution timer when available.
7. Record elapsed time and compute summary statistics.
8. Verify correctness outside the timed region.
9. Record environment metadata and any warnings.
10. Save the result only after the run finishes successfully.

The UI must explain whether a measurement includes key expansion, input conversion, padding, allocation, and output conversion. Do not mix methodologies in a comparison without labeling them.

### 8.4 Metrics

For each run, collect the following where supported:

- Total measured time.
- Mean latency per operation.
- Median latency.
- Minimum and maximum latency.
- Standard deviation.
- p95 latency, when enough samples are available.
- Payload size in bytes.
- Throughput in bytes/second or MiB/second.
- Encryption and decryption time separately.
- Key-schedule/setup time separately, if measured.
- Iteration count and warm-up count.
- Error/correctness status.
- Environment metadata.

Use clearly defined units. Distinguish microseconds (`µs`), milliseconds (`ms`), bytes/second, and MiB/second.

Throughput calculation:

`throughput_bytes_per_second = total_payload_bytes_processed / total_elapsed_seconds`

For a per-operation latency summary, use the actual measured iteration data rather than dividing unrelated averages. Document the exact formula used in the UI/report.

### 8.5 Timing quality and limitations

- Use a monotonic high-resolution clock when supported.
- Never display a negative or zero elapsed time as a meaningful performance result.
- If timer resolution is too coarse, increase the batch size or aggregate many operations and report the method.
- Use warm-ups to reduce first-run/JIT effects.
- Keep UI rendering and network calls outside the timed section.
- Use the same methodology for configurations being compared.
- Allow users to rerun tests.
- Show variability; do not imply that one run establishes a definitive ranking.
- If benchmarks run in a browser, label them **browser/runtime benchmark**, not hardware-independent results.
- Resource metrics such as CPU percentage, peak memory, and power must only be shown as measured if the runtime actually exposes a reliable measurement. Otherwise show “not measured” or a clearly labeled estimate.

### 8.6 Key setup versus encryption cost

RC5 includes key expansion. For realistic use, setup cost can matter when a key is changed frequently or messages are very small. The platform should ideally expose two modes:

- **Steady-state mode:** Key schedule is prepared before timing; measures repeated encryption/decryption work.
- **End-to-end cipher-call mode:** Includes key setup where applicable.

Keep these results separate so users do not compare unlike measurements.

## 9. Configuration Comparison

Users must be able to select at least two configurations and run the same workload against each.

### 9.1 Comparison table

Include columns for:

- Configuration name.
- Word size.
- Rounds.
- Key length.
- Block size.
- Payload size.
- Mean and median encryption time.
- Mean and median decryption time.
- p95 latency, if available.
- Throughput.
- Setup/key-schedule time, if measured.
- Correctness status.
- Measurement environment.
- Security/interpretation notes.

Allow sorting by latency, throughput, rounds, and key length. Allow filtering by payload size and operation.

### 9.2 Visualizations

Include:

- Latency versus number of rounds.
- Throughput versus payload size.
- Encryption versus decryption timing.
- Configuration comparison bars.
- Latency distribution or box plot where enough samples exist.
- A resource chart only for resources actually measured or explicitly estimated.

Charts must be generated from the benchmark result data. Include units, legends, axis labels, and tooltips. Avoid presenting synthetic placeholder values as actual experimental findings.

### 9.3 Interpretation panel

After a comparison, generate a concise explanation based on the observed measurements, for example:

- “Configuration A had lower median latency for this payload on this runtime.”
- “The difference was small relative to observed run-to-run variability.”
- “The higher-round configuration took longer in this test.”
- “These measurements do not establish cryptographic security.”

The system must not claim that a measured faster configuration is safer or that a slower configuration is necessarily more secure.

## 10. Scenario Analysis: IoT and Real-Time Communication

### 10.1 Purpose

This module translates benchmark results into an illustrative scenario. A user describes an application, payload size, compute environment, bandwidth, and time budget, then sees how measured cipher performance fits into the budget.

### 10.2 Scenario inputs

- Scenario name (e.g., sensor telemetry, periodic device status, small command message).
- Payload size in bytes.
- Message frequency or number of messages.
- Latency budget / deadline.
- Selected RC5 configuration.
- Benchmark environment.
- Optional estimated link bandwidth.
- Optional estimated network round-trip or transport delay.
- Optional estimated serialization/processing overhead.
- Whether the scenario is one-way or request/response.

### 10.3 Scenario outputs

- Measured encryption latency for the chosen configuration and relevant payload size.
- Measured decryption latency, if available.
- Estimated transmission time under the entered bandwidth assumption.
- User-entered or assumed network/transport overhead.
- Estimated total time, with each component broken out.
- Remaining latency budget or amount over budget.
- A clear indication of which values were measured and which were estimated.
- A note if no benchmark exists for the selected payload size or runtime.

A simplified one-way estimate may be:

`estimated_total_time = encryption_time + serialization_overhead + transmission_time + network_overhead + decryption_time`

Only include components that apply to the scenario. If the link rate is expressed in bits/second, a simplified payload transmission estimate is:

`transmission_time_seconds = (payload_bytes × 8) / bandwidth_bits_per_second`

The estimate should account for framing/protocol overhead only if the user supplies or the model explicitly estimates it. Do not present the formula as a complete network-performance model.

### 10.4 Example: a 20-second deadline

A user may specify a 20-second deadline. The system should compare the estimated total against 20 seconds and show the remaining budget. It must not assume that a 20-second deadline is a real-time requirement or that cipher latency is the only contributor.

The app should explain that network congestion, retransmissions, scheduling, hardware differences, key setup, and protocol overhead can dominate total latency. A browser benchmark cannot establish how a low-power microcontroller will perform.

### 10.5 Scenario result labels

Use cautious, transparent labels such as:

- “Within the entered timing budget (based on these assumptions)”
- “Over the entered timing budget”
- “Insufficient benchmark data”
- “Security review required”

Do not use labels such as “secure,” “best algorithm,” or “production-ready” based solely on timing.

## 11. Security Analysis and Interpretation

This is an educational analysis section, not a cryptographic certification engine.

### 11.1 Separate performance from security

Display separate categories:

1. **Measured performance:** empirical timing and throughput.
2. **Configuration facts:** word size, rounds, key length, block size.
3. **Security context:** documented caveats, known limitations, and suitability warnings.
4. **Deployment context:** mode of operation, authentication, key management, threat model, and implementation review requirements.

### 11.2 Security guidance

- More rounds generally add computational work, but no simple rule makes a setting secure.
- Key length is not the same as effective security.
- RC5 block size depends on word size; small block sizes can create data-volume and collision concerns in common block-cipher modes.
- ECB should not be recommended for ordinary multi-block data encryption because it reveals repeated block patterns.
- Padding does not provide integrity or authenticity.
- Encryption alone does not prevent malicious modification.
- A complete communication system needs carefully selected modes/protocols, authentication, safe nonce/IV handling where applicable, key management, and implementation review.
- Modern applications should normally prefer well-reviewed, currently recommended authenticated-encryption schemes rather than adopt RC5 for new sensitive-data deployments.

### 11.3 Security display model

Avoid a numerical “security score” unless a defensible, documented methodology is developed and reviewed. For the MVP, use explanatory warnings and source-backed notes instead of fabricated percentages or red/green “secure” badges.

Any scenario table should use phrases such as “lower computational cost in this experiment” and “security suitability not established,” not “weak but safe” or “balanced security” without evidence.

## 12. Scenario Presets and Configuration Catalog

The platform should include a small educational catalog of example profiles. All entries must be marked as **comparison presets, not deployment recommendations**.

Suggested starting profiles:

| Preset | RC5 parameters | Intended experiment |
|---|---|---|
| RC5-32/12/16 | w=32, r=12, b=16 bytes | Baseline timing and correctness comparison |
| RC5-32/16/16 | w=32, r=16, b=16 bytes | Study the effect of more rounds |
| RC5-32/20/16 | w=32, r=20, b=16 bytes | Study a higher round count |
| Custom profile | Supported user-selected values | Explore a chosen parameter combination |

Do not label these as “famous industry standards” unless that status is independently verified. A preset should include source/justification metadata if it is described as a literature-derived configuration.

The comparison table should eventually let users add their own experimental profiles and label a result as “fastest in this test,” “lowest observed latency,” or “highest observed throughput.” Do not equate these labels with security rankings.

## 13. User Interface and Experience

The application should look like a polished developer/scientific tool: structured, precise, data-rich, and easy to navigate. Use consistent spacing, clear hierarchy, restrained color, legible charts, and responsive layouts.

### 13.1 Main navigation

- Overview
- Learn RC5
- Simulator
- Benchmark Lab
- Compare Configurations
- Scenario Planner
- Experiments / Reports
- Methodology & About

### 13.2 Overview dashboard

Display:
- Short introduction to RC5 CipherLab.
- Quick actions: “Try encryption,” “Run benchmark,” “Compare configurations.”
- Last experiment summary, if available.
- Recent benchmark runs.
- A clear educational-use warning.
- A short explanation of measured versus estimated metrics.

### 13.3 Learn RC5 page

Use a readable article layout with:
- RC5 definition.
- Parameter notation diagram.
- Block size/key length explanation.
- Simplified encryption/decryption flow.
- Definitions of XOR, modular addition, and circular rotation.
- Security limitations.
- Glossary and references.

### 13.4 Simulator page

Recommended layout:
- Left column: configuration and input/key settings.
- Main panel: plaintext, key, padding, Encrypt/Decrypt controls.
- Results panel: ciphertext/decrypted bytes, encoding, byte count, correctness status.
- Optional advanced panel: execution time and configuration metadata.

Never display the secret key in URLs, analytics events, or persistent logs. Provide a “clear inputs” action.

### 13.5 Benchmark Lab page

Include:
- Configuration builder and presets.
- Payload size selector.
- Warm-up and measured iteration inputs.
- Encryption/decryption selection.
- Start, cancel, and rerun actions.
- Progress and cancellation state.
- Results summary, distribution, and environment information.
- Warnings when a run is too short, too noisy, or invalid.

Use a Web Worker or equivalent isolation for long browser computations so the interface remains responsive, if browser-side benchmarking is selected.

### 13.6 Compare page

- Select saved runs or create a new comparison.
- Require compatible payload sizes and methodologies for direct comparisons.
- Highlight differences without hiding the absolute values.
- Provide table and chart views.
- Explain when configurations were measured in different environments.

### 13.7 Scenario Planner page

- Scenario form on one side.
- Selected benchmark and assumptions on the other.
- Timing budget visualization.
- Breakdown of encryption, transmission, overhead, and decryption.
- Clear distinction between measured and estimated values.
- Caution note on real hardware validation.

### 13.8 Reports page

- Search and filter saved experiments.
- Open a run's full details.
- Compare runs.
- Export CSV/JSON/Markdown, and PDF if implemented.
- Include configuration, methodology, results, environment, assumptions, and caveats in every exported report.

### 13.9 UX requirements

- Responsive on desktop, tablet, and mobile.
- Keyboard-accessible forms and actions.
- Clear validation messages.
- Loading, empty, success, error, and cancellation states.
- Confirmation before clearing or deleting saved experiments.
- Copy-to-clipboard feedback.
- No fake data presented as actual benchmark output.
- Use tooltips for cryptographic terminology and units.
- Make advanced settings available without overwhelming first-time users.

## 14. Functional Requirements

### FR-01: Educational overview
The system shall present an introduction to RC5, its parameter notation, operation, and security limitations.

### FR-02: Parameter configuration
The system shall allow users to select supported word size, round count, and key length.

### FR-03: Presets
The system shall provide editable experiment presets and identify them as educational profiles.

### FR-04: Input handling
The system shall support UTF-8 text and hexadecimal byte inputs with validation.

### FR-05: Encryption
The system shall encrypt supported inputs using the selected RC5 parameters and selected block-handling policy.

### FR-06: Decryption
The system shall decrypt valid ciphertext and indicate whether the recovered bytes match the original input.

### FR-07: Correctness
The system shall validate the RC5 implementation against reference test vectors and automated tests.

### FR-08: Benchmark execution
The system shall execute configurable benchmark workloads with warm-up and measured iterations.

### FR-09: Timing metrics
The system shall calculate documented latency and throughput metrics from measured data.

### FR-10: Configuration comparison
The system shall compare multiple configurations using compatible workloads and display the results in a table and charts.

### FR-11: Scenario analysis
The system shall calculate illustrative latency-budget estimates from measured cipher timings and explicit user assumptions.

### FR-12: Experiment history
The system shall allow users to save and revisit benchmark metadata and results without storing plaintext or secret keys by default.

### FR-13: Export
The system shall export selected benchmark results and methodology in a machine-readable format and a human-readable report.

### FR-14: Environment metadata
The system shall record available runtime, operating system, implementation version, timestamp, payload size, and benchmark settings.

### FR-15: Security interpretation
The system shall display security caveats and shall not derive a security verdict solely from benchmark metrics.

### FR-16: Error handling
The system shall report invalid inputs, unsupported parameters, malformed ciphertext, failed benchmark runs, and export errors clearly.

### FR-17: Cancellation
The system shall allow a long benchmark to be cancelled when the execution environment supports cancellation.

### FR-18: Data provenance
The system shall distinguish measured results, user-entered assumptions, and computed estimates in the UI and reports.

## 15. Non-Functional Requirements

### Performance
- Normal navigation and form interactions should feel responsive.
- Long benchmarks should not freeze the UI.
- Benchmark results must include enough context to interpret them.

### Reliability
- Invalid parameters must be rejected before computation.
- Encryption/decryption must pass correctness tests.
- A failed run must not be stored as a successful result.

### Security and privacy
- Do not log secret keys or plaintext.
- Do not put sensitive values in URLs.
- Keep secrets in memory only as long as necessary and clear them when possible.
- If persistence is added, persist experiment metadata and results by default, not user key material.
- Clearly state whether computation occurs in the browser or on a server.
- If a server endpoint handles keys or plaintext, document the data flow and avoid unnecessary retention.

### Maintainability
- Keep the RC5 algorithm separate from UI components and HTTP routes.
- Keep benchmark orchestration separate from cipher implementation.
- Use typed interfaces and clear validation boundaries.
- Version the algorithm implementation and benchmark methodology.

### Accessibility
- Keyboard navigation.
- Visible focus states.
- Proper labels and error descriptions.
- Sufficient contrast.
- Charts with textual summaries or tabular alternatives.

## 16. Proposed Technical Architecture

The project should use a modular architecture that allows the algorithm and benchmark runner to be tested independently.

### 16.1 Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- A charting library such as Recharts
- Optional Framer Motion for restrained transitions
- Web Worker for browser-side benchmark execution, if suitable

Responsibilities:
- Form handling and validation.
- Configuration presets.
- Simulator interface.
- Results tables and charts.
- Scenario assumptions and estimate presentation.
- Experiment history and exports.

### 16.2 Backend

For the MVP, use Node.js and Express if persistence and report management are needed.

Responsibilities:
- Validate and store experiment metadata/results.
- Serve saved runs and report data.
- Version experiment schemas.
- Optional server-side benchmark execution in a controlled environment.

Do not assume server-side timing and browser-side timing are comparable. Store the execution environment with each result.

### 16.3 Database

MongoDB is a suitable option consistent with a MERN-oriented implementation. Store:
- Experiment metadata.
- RC5 parameters.
- Workload details.
- Summary metrics and optionally raw timing samples.
- Environment metadata.
- Scenario assumptions and derived estimates.
- Report/export metadata.

Do not store plaintext and secret keys by default.

### 16.4 RC5 engine

Create an isolated module with a clear API, conceptually similar to:

- `validateConfig(config)`
- `expandKey(keyBytes, config)`
- `encryptBlock(blockBytes, expandedKey, config)`
- `decryptBlock(blockBytes, expandedKey, config)`
- `encryptBytes(plaintextBytes, keyBytes, config, paddingPolicy)`
- `decryptBytes(ciphertextBytes, keyBytes, config, paddingPolicy)`

These are design-level function names; adapt them to the selected implementation language and codebase.

The module must explicitly define byte order, word masking, circular-rotation behavior, supported word sizes, key schedule behavior, and error cases. Cryptographic arithmetic bugs must be caught by test vectors.

### 16.5 Benchmark engine

Keep the benchmark runner separate from the UI and cipher logic. It should:
- Prepare workload data.
- Warm up the implementation.
- Time only the intended operation.
- collect samples.
- calculate statistics.
- verify outputs.
- record environment metadata.
- return structured results.

### 16.6 Suggested repository structure

```text
rc5-cipherlab/
├── README.md
├── PRD.md
├── package.json
├── docs/
│   ├── architecture.md
│   ├── methodology.md
│   ├── security-notes.md
│   └── literature-review.md
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── learn/
│   │   │   ├── simulator/
│   │   │   ├── benchmark/
│   │   │   ├── comparison/
│   │   │   ├── scenarios/
│   │   │   └── reports/
│   │   ├── lib/
│   │   └── workers/
│   └── tests/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── models/
│   │   └── validators/
│   └── tests/
└── shared/
    ├── types/
    └── schemas/
```

If the project is implemented entirely in the browser initially, keep the same logical separation even if the server folder is deferred.

## 17. Data Model (Proposed)

### Experiment

- `id`
- `name`
- `createdAt`
- `algorithm`: `"RC5"`
- `implementationVersion`
- `methodologyVersion`
- `configuration`: word size, rounds, key length
- `paddingPolicy`
- `operation`: encryption, decryption, or both
- `payloadSizeBytes`
- `warmupIterations`
- `measuredIterations`
- `timingSamples` (optional; may be omitted or summarized)
- `metrics`: mean, median, min, max, standard deviation, p95, throughput
- `correctnessStatus`
- `environment`: runtime, OS, CPU information if available, browser/server, implementation version
- `notes`
- `tags`

### Scenario

- `id`
- `name`
- `payloadSizeBytes`
- `messageFrequency`
- `latencyBudgetMs`
- `selectedExperimentIds`
- `bandwidthBitsPerSecond` (optional)
- `networkOverheadMs` (optional)
- `serializationOverheadMs` (optional)
- `oneWayOrRequestResponse`
- `assumptions`
- `computedBreakdown`
- `createdAt`

Never include raw secret keys or plaintext in these records by default.

## 18. API Sketch (Optional for MVP)

Potential REST endpoints if the backend is used:

- `GET /api/health` — service health.
- `GET /api/presets` — supported educational presets.
- `POST /api/experiments` — save experiment metadata and results.
- `GET /api/experiments` — list experiment summaries.
- `GET /api/experiments/:id` — retrieve experiment details.
- `DELETE /api/experiments/:id` — delete a saved experiment.
- `POST /api/scenarios/analyze` — compute an estimate from benchmark metrics and assumptions.
- `GET /api/exports/:id` — download a report, if server-generated exports are implemented.

If encryption is executed in the browser, avoid sending plaintext or keys to the backend. If server-side execution is chosen, explicitly disclose the data flow and apply appropriate input limits.

## 19. Testing and Validation Plan

### 19.1 Cryptographic correctness

- Use published RC5 reference test vectors from a reliable source.
- Test each supported word size and configuration class.
- Test encryption followed by decryption returns the original bytes.
- Test empty input if supported by the selected padding policy.
- Test input lengths smaller than, equal to, and greater than one block.
- Test multi-block input.
- Test keys at minimum, typical, and maximum supported lengths.
- Test malformed hexadecimal input.
- Test invalid parameter combinations.
- Test invalid padding and truncated ciphertext.
- Test integer overflow, masking, and circular rotations at boundary values.

### 19.2 Benchmark correctness

- Validate metric calculations against known sample arrays.
- Confirm warm-up samples are excluded.
- Confirm payload byte counts and throughput units.
- Confirm key setup is either included or excluded as declared.
- Confirm cancellation and failed runs are handled correctly.
- Verify a comparison refuses or warns about incompatible methodologies.
- Verify raw results are retained or summarized consistently.

### 19.3 Scenario calculations

- Test zero/invalid bandwidth.
- Test missing benchmark data.
- Test one-way versus request/response assumptions.
- Test timing-budget boundaries.
- Ensure estimates clearly identify user-entered assumptions.
- Ensure measured and estimated values are not mixed.

### 19.4 UI and accessibility

- Keyboard-only navigation.
- Mobile and desktop layouts.
- Loading, empty, error, and success states.
- Long input handling and size limits.
- Copy/export functionality.
- Clear warning language and units.

## 20. Academic Evaluation and Research Methodology

The platform should support a defensible evaluation rather than relying on a single timing measurement.

### 20.1 Research questions

- How does round count affect measured encryption and decryption latency for a fixed word size and key length?
- How does payload size affect throughput and per-operation latency?
- What is the measured difference between key-schedule time and steady-state encryption time?
- How stable are the results across repeated runs?
- How does a parameter change affect performance on the tested runtime?
- Under explicit network assumptions, how does measured cipher time contribute to an illustrative latency budget?

### 20.2 Experimental controls

- Change one parameter at a time for controlled experiments.
- Use identical payloads and iteration counts when comparing configurations.
- Record the execution environment and implementation version.
- Perform warm-up runs.
- Repeat experiments and report variation.
- Separate results from different hardware/runtime environments.
- State limitations, including that JavaScript/browser results do not generalize automatically to microcontrollers.
- Do not infer cryptographic strength from timing data.

### 20.3 Report format

Every report should include:
1. Experiment objective.
2. Hypothesis or research question.
3. RC5 parameters and padding policy.
4. Test payloads and key setup methodology.
5. Hardware/runtime environment.
6. Warm-up and iteration counts.
7. Results table and charts.
8. Statistical summary.
9. Interpretation.
10. Security and validity limitations.
11. Reproduction instructions.
12. Date and implementation/methodology versions.

## 21. Error and Edge-Case Handling

The UI should handle:
- Missing plaintext, ciphertext, or key.
- Invalid hex characters.
- Unsupported word size or round count.
- Key length mismatch.
- Incomplete block in raw-block mode.
- Invalid padding.
- Excessive payload size or iteration count.
- Benchmark cancellation.
- Timer precision limitations.
- Missing resource measurement capability.
- Incompatible comparison results.
- Missing or stale saved experiment.
- Export failure.
- Backend unavailable, if applicable.

Messages should explain how to fix the issue without exposing internal stack traces or secrets.

## 22. MVP Prioritization

### P0 — Required for the first working demonstration

- Educational RC5 overview and safety caveat.
- Supported RC5 configuration controls.
- Text and hex input.
- Correct encryption and decryption.
- One explicit, tested padding policy plus strict validation.
- Correctness tests and reference vectors.
- Benchmark runner with warm-up and repeated measurements.
- Core timing and throughput metrics.
- Comparison table and at least two useful charts.
- Measured-versus-estimated labels.
- CSV or JSON export.
- Responsive, polished UI.

### P1 — High value after P0 works

- Scenario Planner with latency budget.
- Experiment history.
- Markdown report export.
- Key-schedule timing.
- More payload-size presets.
- Saved configuration presets.
- Detailed methodology page.
- Benchmark result variability visualization.

### P2 — Optional enhancements

- PDF export.
- Accounts and cloud-synced results.
- Multi-device/embedded benchmark client.
- Actual device telemetry for CPU, memory, and power.
- Comparison with modern authenticated-encryption algorithms.
- Shared experiments and collaborative workspaces.

Do not begin P1/P2 features until RC5 correctness and the benchmark methodology are trustworthy.

## 23. Definition of Done

The MVP is complete when:

- A user can learn the core concepts and understand the parameters.
- A user can configure supported RC5 values and encrypt/decrypt sample input.
- Correctness is supported by tests, not only by a successful UI demonstration.
- A user can run repeatable benchmarks across multiple payload sizes.
- Results show timing, throughput, iteration counts, and environment details.
- The user can compare configurations fairly.
- The user can create an illustrative scenario with a latency budget and see the assumptions.
- The user can export a useful experiment report.
- No secret keys or plaintext are stored by default.
- Security wording is cautious and technically defensible.
- The UI works at common screen sizes and handles error states.
- Documentation explains how to run, test, and reproduce the experiments.

## 24. Final Product Principle

**RC5 CipherLab is a measurement and learning tool, not a security-certification tool.**

Its core value is the ability to configure RC5, verify the encryption/decryption result, measure implementation performance, compare controlled experiments, and understand how measured computation contributes to a scenario's timing budget.

The platform should make evidence visible, assumptions explicit, and security limitations impossible to miss.
