const util = require("util");
const crypto = require("crypto");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// Escape codes are only useful on a terminal; anywhere else (a log file, a captured container
// stream) they are noise, so LOG_COLOR can force the decision either way.
const USE_COLOR = process.env.LOG_COLOR === "1"
    || (process.env.LOG_COLOR !== "0" && Boolean(process.stdout.isTTY));

const RAW_COLORS = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    dim: "\x1b[2m",
    reset: "\x1b[0m"
};

const COLORS = Object.fromEntries(
    Object.keys(RAW_COLORS).map((key) => [key, USE_COLOR ? RAW_COLORS[key] : ""])
);

// Anything whose key looks like a credential is replaced before it can reach a log line or a
// crash report, because errors from axios/googleapis routinely carry full request configs.
const SECRET_KEY_PATTERN = /(key|token|secret|password|credential|authorization|cookie)/i;
const REDACTED = "[redacted]";

const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 6;

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keeps the frames that point at our own code.
 *
 * Express, body-parser and the Google SDKs contribute dozens of frames that are identical for every
 * failure, and they push the one useful line out of view. Library frames are kept only when there
 * are no application frames at all, so a crash inside a dependency is still diagnosable.
 */
function trimStack(stack) {
    const lines = stack.split("\n");
    const header = lines[0];
    const frames = lines.slice(1);

    const ownFrames = frames.filter((line) => !line.includes("node_modules") && !line.includes("node:internal"));
    const kept = ownFrames.length > 0 ? ownFrames : frames;
    const hidden = frames.length - kept.length;

    const out = [header, ...kept.slice(0, 10)];
    if (hidden > 0) {
        out.push(`    … ${hidden} library frames omitted`);
    }
    return out.join("\n");
}

function truncate(value) {
    if (typeof value !== "string" || value.length <= MAX_STRING_LENGTH) {
        return value;
    }
    return `${value.slice(0, MAX_STRING_LENGTH)}… [${value.length - MAX_STRING_LENGTH} more chars]`;
}

function sanitize(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return truncate(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
    if (Buffer.isBuffer(value)) return `[buffer ${value.length} bytes]`;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return serializeError(value, depth);
    if (depth >= MAX_DEPTH) return "[max depth reached]";

    if (Array.isArray(value)) {
        const head = value.slice(0, 20).map((item) => sanitize(item, depth + 1));
        if (value.length > 20) head.push(`… ${value.length - 20} more items`);
        return head;
    }

    if (isPlainObject(value) || typeof value === "object") {
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            // Only strings can leak a credential; redacting a boolean or a count would hide
            // useful diagnostics like `hasApiKey: false`.
            const shouldRedact = typeof val === "string" && val.length > 0 && SECRET_KEY_PATTERN.test(key);
            out[key] = shouldRedact ? REDACTED : sanitize(val, depth + 1);
        }
        return out;
    }

    return String(value);
}

/**
 * Pulls every diagnostically useful field off an error, whatever library threw it.
 *
 * The failure modes we care about each hide their real cause in a different place: axios keeps the
 * HTTP status under `response`, the Gen AI SDK puts it on `status`, Node network errors only set
 * `code`, and AppError carries `code` plus `details`. Reading `error.message` alone discards all of it.
 */
function serializeError(error, depth = 0) {
    if (!error) return null;
    if (typeof error !== "object") return { message: String(error) };

    const out = {
        name: error.name,
        message: truncate(error.message)
    };

    if (error.code !== undefined) out.code = error.code;
    if (error.errno !== undefined) out.errno = error.errno;
    if (error.syscall !== undefined) out.syscall = error.syscall;
    if (error.status !== undefined) out.status = error.status;
    if (error.statusCode !== undefined) out.statusCode = error.statusCode;
    if (error.type !== undefined) out.type = error.type;
    if (error.errorId !== undefined) out.errorId = error.errorId;
    if (error.httpStatus !== undefined) out.httpStatus = error.httpStatus;
    if (error.retryable !== undefined) out.retryable = error.retryable;
    if (error.details !== undefined) out.details = sanitize(error.details, depth + 1);

    // axios / googleapis
    if (error.response) {
        out.response = {
            status: error.response.status,
            statusText: error.response.statusText,
            data: sanitize(error.response.data, depth + 1)
        };
    }
    if (error.config) {
        out.request = {
            method: error.config.method,
            url: truncate(error.config.url),
            timeout: error.config.timeout
        };
    }

    if (error.stack) {
        out.stack = trimStack(error.stack);
    }

    // A wrapped cause is usually the real story, so keep walking down the chain.
    if (error.cause && depth < MAX_DEPTH) {
        out.cause = serializeError(error.cause, depth + 1);
    }

    return out;
}

function formatPretty(entry) {
    const { level, time, message, ...rest } = entry;
    const color = COLORS[level] || "";
    const label = level.toUpperCase().padEnd(5);
    const context = rest.requestId ? ` ${COLORS.dim}[${rest.requestId}]${COLORS.reset}` : "";

    let line = `${COLORS.dim}${time}${COLORS.reset} ${color}${label}${COLORS.reset}${context} ${message}`;

    const { requestId, err, ...fields } = rest;
    if (Object.keys(fields).length > 0) {
        line += ` ${COLORS.dim}${util.inspect(fields, { depth: 5, breakLength: 140, colors: false })}${COLORS.reset}`;
    }
    if (err) {
        line += `\n${color}${util.inspect(err, { depth: 6, breakLength: 140, colors: false })}${COLORS.reset}`;
    }
    return line;
}

class Logger {
    constructor(bindings = {}) {
        this.bindings = bindings;
        this.level = LEVELS[(process.env.LOG_LEVEL || "").toLowerCase()]
            || (process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug);
        this.format = (process.env.LOG_FORMAT || "").toLowerCase() === "json" ? "json" : "pretty";
    }

    /** Returns a logger that stamps every line with extra context, e.g. a requestId. */
    child(bindings) {
        const child = new Logger({ ...this.bindings, ...bindings });
        child.level = this.level;
        child.format = this.format;
        return child;
    }

    write(level, message, fields = {}) {
        if (LEVELS[level] < this.level) return;

        const { error, ...rest } = fields;
        const entry = {
            level,
            time: new Date().toISOString(),
            message,
            ...sanitize(this.bindings),
            ...sanitize(rest)
        };
        if (error) {
            entry.err = serializeError(error);
        }

        const line = this.format === "json" ? JSON.stringify(entry) : formatPretty(entry);

        // Everything goes to one stream on purpose. Splitting warn/error onto stderr lets the two
        // streams interleave once they are merged again (docker logs, a tunnel, a file), which
        // breaks multi-line error blocks apart. LOG_STDERR=1 restores the split if a host needs it.
        if (process.env.LOG_STDERR === "1" && (level === "error" || level === "warn")) {
            process.stderr.write(`${line}\n`);
        } else {
            process.stdout.write(`${line}\n`);
        }
    }

    debug(message, fields) { this.write("debug", message, fields); }
    info(message, fields) { this.write("info", message, fields); }
    warn(message, fields) { this.write("warn", message, fields); }
    error(message, fields) { this.write("error", message, fields); }
}

/** Short, human-quotable id so a user-reported failure can be found in the logs. */
function newRequestId() {
    return crypto.randomBytes(4).toString("hex");
}

const logger = new Logger();

module.exports = { logger, Logger, serializeError, sanitize, newRequestId };
