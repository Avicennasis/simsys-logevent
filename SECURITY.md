# Security Policy

## Supported versions

Only the latest `0.x.y` tag is supported. Fixes will land on `main` and be
cut as a new patch release; older tags will not be back-patched.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Email **avicennasis@gmail.com** with:

- A description of the issue.
- Steps to reproduce (or a proof-of-concept).
- The version or commit SHA you found it against.
- Any suggested mitigation if you have one.

Expect an acknowledgement within a week. This is a side-project package —
there is no bug bounty and no SLA — but I take security issues seriously
and will coordinate a fix and disclosure with you.

## What's in scope

This package is a tiny stdout writer: `configure({service})` once at
startup, `logEvent({event, ...})` per call. One JSON line per call. No
transports, no batching, no sampling. No runtime dependencies.

In-scope issues:

- Crashes, hangs, or unbounded memory growth triggered through the
  package's public API (`configure`, `logEvent`) on any input the type
  signatures permit.
- Violation of the **never-throws** contract: `logEvent` is documented to
  never throw, regardless of caller-supplied payload. A reproducer where a
  payload causes `logEvent` to throw is in scope.
- Output that breaks downstream JSON parsing — e.g. a payload that causes
  the emitted line to contain unescaped control characters, embedded
  newlines, or otherwise invalid JSON, such that systemd-journal or
  Loki's `| json` filter mis-parses subsequent lines.
- Reserved-field clobbering — if a caller-supplied field can overwrite
  the library's auto-stamped `ts`, `level`, or `service` in a way that
  silently breaks the documented schema, that's in scope.

## What's out of scope

- **Caller logging sensitive data.** The library has no input filtering by
  design. Passing PII, secrets, credentials, or session tokens to
  `logEvent` is the caller's responsibility; redaction belongs in the
  caller.
- **Log injection from attacker-controlled inputs.** If a caller passes
  user-supplied strings verbatim as `event` names or field values without
  validating them, the resulting log line will faithfully reflect that —
  that's an application-layer concern, not a library bug.
- **Downstream pipeline misconfiguration.** systemd-journal rate limits,
  Alloy filter rules, Loki retention/cardinality, Grafana access controls
  — none of these are in this library's scope.
- **Performance under extreme log volume.** The library does no rate
  limiting, sampling, or buffering. If your service logs at a rate that
  saturates stdout or the journal, throttle at the caller. (See README for
  the cardinality reminder on Alloy label promotion.)
- **Issues in upstream dependencies.** The package has zero runtime
  dependencies, so this category is empty in practice. Dev-time issues
  (TypeScript, vitest, @types/node) should be reported to those
  projects.
