const { logger, newRequestId } = require("../utils/Logger");

/**
 * Gives every request an id and a logger bound to it, then logs how the request finished.
 *
 * The id is echoed back in the `X-Request-Id` header and in error bodies, so a screenshot from a
 * user is enough to find the matching log lines.
 */
function requestContext(req, res, next) {
    req.id = req.headers["x-request-id"] || newRequestId();
    req.log = logger.child({ requestId: req.id });
    req.startedAt = Date.now();

    res.setHeader("X-Request-Id", req.id);

    req.log.debug("Request received", {
        method: req.method,
        path: req.originalUrl,
        origin: req.headers.origin,
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"]
    });

    res.on("finish", () => {
        const durationMs = Date.now() - req.startedAt;
        const fields = { method: req.method, path: req.originalUrl, status: res.statusCode, durationMs };

        // Failures are already logged in detail by the error handler, so this is just the summary line.
        if (res.statusCode >= 500) {
            req.log.error("Request failed", fields);
        } else if (res.statusCode >= 400) {
            req.log.warn("Request rejected", fields);
        } else {
            req.log.info("Request completed", fields);
        }
    });

    next();
}

module.exports = { requestContext };
