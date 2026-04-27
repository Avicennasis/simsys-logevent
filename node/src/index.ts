/**
 * @simsys/logevent — Structured log events for Node.js apps.
 *
 * Writes JSON-per-line to stdout. Designed for systemd-journal → Loki
 * pipelines (Grafana Alloy `loki.source.journal`). Every event becomes a
 * single LogQL-queryable JSON line.
 *
 * Public API:
 *
 *   import { logEvent, configure } from "@simsys/logevent";
 *   configure({ service: "board-portal" });
 *   logEvent({ event: "auth.signin", user: "alice@example.org", outcome: "success" });
 *
 * The shape is intentionally flat. Callers add whatever event-specific
 * fields they need; the library only ensures `ts`, `level`, and `service`
 * are always present.
 *
 * Cardinality reminder: Loki labels ≠ JSON fields. Anything passed here
 * lives inside the log body and is parsed at query time with `| json`,
 * which keeps high-cardinality values (user IDs, free-form text) out of
 * Loki's index. Don't promote these to labels in your Alloy config.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEventPayload {
  /** Dot-separated kebab event type, e.g. "auth.signin", "shift.assigned". */
  event: string;
  /** "info" by default. */
  level?: LogLevel;
  /** User identifier (email, uid). Free-form; not bounded by the library. */
  user?: string;
  /** HTTP route or logical action surface. */
  route?: string;
  /** Result classifier — typically "success" | "failure" | "blocked". */
  outcome?: string;
  /** Anything event-specific. */
  [key: string]: unknown;
}

interface Config {
  service: string;
  defaultLevel: LogLevel;
  out: (line: string) => void;
}

const config: Config = {
  service: "unknown",
  defaultLevel: "info",
  out: (line: string) => {
    process.stdout.write(line + "\n");
  },
};

export interface ConfigureOpts {
  /** Service name. Required — used for filtering in Loki. */
  service: string;
  /** Default level when callers omit one. Defaults to "info". */
  defaultLevel?: LogLevel;
  /** Override sink. Defaults to process.stdout. Useful in tests. */
  out?: (line: string) => void;
}

/**
 * Configure the module-level state. Typically called once at startup
 * (instrumentation.ts, server.js entry, etc.).
 */
export function configure(opts: ConfigureOpts): void {
  if (!opts.service || typeof opts.service !== "string") {
    throw new Error("configure(): opts.service must be a non-empty string.");
  }
  config.service = opts.service;
  if (opts.defaultLevel) {
    config.defaultLevel = opts.defaultLevel;
  }
  if (opts.out) {
    config.out = opts.out;
  }
}

/**
 * Emit one structured log event. Writes JSON-per-line to the configured
 * sink (process.stdout by default).
 *
 * Errors inside the emitter are swallowed: logging must never throw into
 * a request handler.
 */
export function logEvent(payload: LogEventPayload): void {
  if (!payload || typeof payload !== "object") {
    return;
  }
  if (!payload.event || typeof payload.event !== "string") {
    return;
  }
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level: payload.level || config.defaultLevel,
      service: config.service,
      ...payload,
    });
    config.out(line);
  } catch {
    // Circular references or non-serialisable values — drop silently.
    // The alternative (throwing) would crash request handlers on a
    // bad payload, which is far worse than a missing log line.
  }
}

/** For tests / advanced consumers — expose current service name. */
export function getService(): string {
  return config.service;
}
