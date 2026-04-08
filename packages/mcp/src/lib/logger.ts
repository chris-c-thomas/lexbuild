/**
 * Lightweight logger interface compatible with pino's API for future swap.
 * Writes to stderr to avoid corrupting stdio transport's stdout JSON-RPC stream.
 */

/** Structured logger interface. Pino-compatible shape for future migration. */
export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/** Creates a console-based logger that writes JSON to stderr. */
export function createLogger(level: LogLevel, bindings?: Record<string, unknown>): Logger {
  const threshold = LEVEL_PRIORITY[level];
  const baseBindings = bindings ?? {};

  function log(msgLevel: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[msgLevel] > threshold) return;

    const entry = {
      level: msgLevel,
      time: Date.now(),
      msg,
      ...baseBindings,
      ...data,
    };

    console.error(JSON.stringify(entry));
  }

  return {
    info: (msg, data) => log("info", msg, data),
    warn: (msg, data) => log("warn", msg, data),
    error: (msg, data) => log("error", msg, data),
    debug: (msg, data) => log("debug", msg, data),
    child: (childBindings) => createLogger(level, { ...baseBindings, ...childBindings }),
  };
}
