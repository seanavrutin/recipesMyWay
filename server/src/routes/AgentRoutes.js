const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const InstagramSession = require("../services/InstagramSession");
const { AppError } = require("../utils/AppError");
const { asyncRoute } = require("../utils/routeHelpers");

/**
 * Only the Instagram agent on VM 102 may call these routes.
 *
 * Port 3000 is also published through the Cloudflare tunnel, and Cloudflare stamps every request it
 * forwards with CF-Connecting-IP, so anything carrying it came from the internet and is refused
 * outright. LAN callers must also present INSTAGRAM_AGENT_TOKEN.
 */
function requireAgent(req, res, next) {
    if (req.headers["cf-connecting-ip"]) {
        return next(new AppError("AGENT_FORBIDDEN", { details: { reason: "request came through the public tunnel" } }));
    }

    const expected = process.env.INSTAGRAM_AGENT_TOKEN;
    if (!expected) {
        return next(new AppError("AGENT_FORBIDDEN", { details: { reason: "INSTAGRAM_AGENT_TOKEN is not set on the server" } }));
    }

    const presented = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    // Compare digests so the comparison takes the same time whatever the input length.
    const digest = (value) => crypto.createHash("sha256").update(value).digest();
    if (!crypto.timingSafeEqual(digest(presented), digest(expected))) {
        return next(new AppError("AGENT_FORBIDDEN", {
            details: { reason: "wrong or missing token", remoteAddress: req.socket.remoteAddress }
        }));
    }

    next();
}

router.use(requireAgent);

/**
 * The agent's daily push of the Instagram login cookies.
 */
router.post("/instagram-session", asyncRoute(async (req, res) => {
    const { sessionId, csrfToken, dsUserId, userAgent, username } = req.body || {};

    const missingFields = [["sessionId", sessionId], ["csrfToken", csrfToken], ["dsUserId", dsUserId]]
        .filter(([, value]) => typeof value !== "string" || value.length === 0)
        .map(([name]) => name);
    if (missingFields.length > 0) {
        throw new AppError("VALIDATION_FAILED", { details: { missingFields } });
    }

    const previousSessionId = (await InstagramSession.get())?.sessionId;
    const previous = InstagramSession.status();
    const saved = await InstagramSession.save({ sessionId, csrfToken, dsUserId, userAgent, username });

    req.log.info("Instagram session updated by agent", {
        username: saved.username,
        dsUserId: saved.dsUserId,
        sameSession: sessionId === previousSessionId,
        previousStatus: previous.status,
        previousUpdatedAt: previous.updatedAt
    });
    res.json({ saved: true, updatedAt: saved.updatedAt });
}));

module.exports = router;
