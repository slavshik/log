/**
 * Numeric log levels. The higher the number, the more verbose the level:
 * a message is printed while `currentLevel >= LogLevel[method]`.
 *
 * Note that `info` sorts below `error` and `warn`, so a low level keeps
 * `info` but drops them. The numbering is kept for backwards compatibility.
 */
export const LogLevel = {
    fatal: 1,
    info: 2,
    error: 3,
    warn: 4,
    debug: 5,
    trace: 6
} as const;

export type LogLevelName = keyof typeof LogLevel;

export const LOG_LEVEL_NAMES: LogLevelName[] = ["fatal", "info", "error", "warn", "debug", "trace"];

/** Accepts either a numeric level or its name. */
export const resolveLevel = (level: LogLevelName | number): number =>
    typeof level === "number" ? level : LogLevel[level];

/** Level names that a build with `level` as its ceiling can safely remove. */
export const strippableLevels = (level: LogLevelName | number): LogLevelName[] => {
    const ceiling = resolveLevel(level);
    return LOG_LEVEL_NAMES.filter(name => LogLevel[name] > ceiling);
};
