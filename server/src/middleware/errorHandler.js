const multer = require("multer");
const { AppError } = require("../utils/AppError");
const { logger } = require("../utils/Logger");

function notFoundHandler(req, res) {
    (req.log || logger).warn("No route matched", { method: req.method, path: req.originalUrl });
    res.status(404).json({ error: "הנתיב המבוקש לא נמצא.", code: "ROUTE_NOT_FOUND", errorId: req.id });
}

/**
 * The single place where an error becomes a log entry and an HTTP response.
 *
 * Anything that is not already an AppError is classified here first, so no failure can reach the
 * client as an unexplained 500 with nothing written to the log.
 */
function errorHandler(error, req, res, next) {
    const log = req.log || logger;
    const appError = normalize(error);

    const logFields = {
        error: appError,
        code: appError.code,
        httpStatus: appError.httpStatus,
        method: req.method,
        path: req.originalUrl,
        durationMs: req.startedAt ? Date.now() - req.startedAt : undefined
    };

    if (appError.logLevel === "warn") {
        log.warn(`Request failed with ${appError.code}`, logFields);
    } else {
        log.error(`Request failed with ${appError.code}`, logFields);
    }

    if (res.headersSent) {
        log.error("Response already sent, destroying the connection", { code: appError.code });
        res.destroy();
        return;
    }

    // `error` stays a plain Hebrew sentence because the client renders it directly; `code` and
    // `errorId` are additive so a failure can be traced without reading the message.
    res.status(appError.httpStatus).json({
        error: appError.userMessage,
        code: appError.code,
        errorId: req.id,
        retryable: appError.retryable
    });
}

function normalize(error) {
    if (error instanceof AppError) return error;

    if (error instanceof multer.MulterError) {
        const code = error.code === "LIMIT_FILE_SIZE" ? "IMAGE_INVALID" : "VALIDATION_FAILED";
        return new AppError(code, {
            message: `Upload rejected: ${error.code} on field ${error.field}`,
            cause: error,
            details: { multerCode: error.code, field: error.field }
        });
    }

    // A malformed JSON body surfaces as a SyntaxError from express.json().
    if (error instanceof SyntaxError && "body" in error) {
        return new AppError("VALIDATION_FAILED", {
            message: "Request body was not valid JSON",
            cause: error,
            details: { bodyPreview: String(error.body).slice(0, 200) }
        });
    }

    return AppError.from(error, "INTERNAL");
}

module.exports = { errorHandler, notFoundHandler };
