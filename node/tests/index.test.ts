import { describe, expect, it, beforeEach } from "vitest";
import { configure, logEvent, getService } from "../src/index.js";

let captured: string[] = [];

beforeEach(() => {
  captured = [];
  configure({
    service: "test-service",
    out: (line) => {
      captured.push(line);
    },
  });
});

describe("logEvent", () => {
  it("emits one JSON line per call", () => {
    logEvent({ event: "demo.event" });
    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.event).toBe("demo.event");
  });

  it("includes ts, level, and service automatically", () => {
    logEvent({ event: "demo.event" });
    const parsed = JSON.parse(captured[0]);
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(parsed.level).toBe("info");
    expect(parsed.service).toBe("test-service");
  });

  it("respects level override", () => {
    logEvent({ event: "boom", level: "error" });
    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe("error");
  });

  it("preserves event-specific fields", () => {
    logEvent({
      event: "shift.assigned",
      user: "alice@example.org",
      route: "/api/shifts/123/assign",
      outcome: "success",
      shift_id: "abc123",
    });
    const parsed = JSON.parse(captured[0]);
    expect(parsed.user).toBe("alice@example.org");
    expect(parsed.route).toBe("/api/shifts/123/assign");
    expect(parsed.outcome).toBe("success");
    expect(parsed.shift_id).toBe("abc123");
  });

  it("does not emit when event is missing", () => {
    // @ts-expect-error — testing runtime guard
    logEvent({ user: "alice" });
    expect(captured).toHaveLength(0);
  });

  it("does not emit when payload is null/undefined", () => {
    // @ts-expect-error — testing runtime guard
    logEvent(null);
    // @ts-expect-error — testing runtime guard
    logEvent(undefined);
    expect(captured).toHaveLength(0);
  });

  it("swallows circular-reference errors silently", () => {
    const circular: Record<string, unknown> = { event: "demo" };
    circular.self = circular;
    expect(() => logEvent(circular as never)).not.toThrow();
    expect(captured).toHaveLength(0);
  });

  it("uses configured defaultLevel when level omitted", () => {
    configure({
      service: "test-service",
      defaultLevel: "warn",
      out: (line) => captured.push(line),
    });
    logEvent({ event: "demo" });
    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe("warn");
  });
});

describe("configure", () => {
  it("requires service", () => {
    // @ts-expect-error — testing runtime guard
    expect(() => configure({})).toThrow(/service/);
  });

  it("rejects non-string service", () => {
    // @ts-expect-error — testing runtime guard
    expect(() => configure({ service: 123 })).toThrow(/service/);
  });

  it("getService reflects last configure call", () => {
    configure({ service: "alpha", out: () => {} });
    expect(getService()).toBe("alpha");
    configure({ service: "beta", out: () => {} });
    expect(getService()).toBe("beta");
  });
});
