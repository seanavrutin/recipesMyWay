const axios = require("axios");
const { AppError } = require("../utils/AppError");
const { logger: rootLogger } = require("../utils/Logger");
const InstagramSession = require("./InstagramSession");

const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 20000);
const MIN_CAPTION_LENGTH = 120;

// The public app id Instagram's own web client sends; the private API refuses requests without it.
const IG_WEB_APP_ID = "936619743392459";
const FALLBACK_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
// Also matches the /<username>/p/<code> form that profile grids link to. /share/… codes are not
// shortcodes; those links are resolved by redirect instead.
const SHORTCODE_PATTERN = /^\/(?:(?!share\/)[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;
// Instagram's answers when the session is no longer accepted.
const LOGGED_OUT_MESSAGES = ["login_required", "checkpoint_required", "challenge_required", "feedback_required"];

function isInstagramUrl(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
    } catch {
        return false;
    }
}

/** A post's shortcode is its numeric media id written in URL-safe base64. */
function shortcodeToMediaId(shortcode) {
    let id = 0n;
    for (const char of shortcode) {
        const value = SHORTCODE_ALPHABET.indexOf(char);
        if (value < 0) throw new Error(`Invalid shortcode character: ${char}`);
        id = id * 64n + BigInt(value);
    }
    return id.toString();
}

function extractShortcode(url) {
    try {
        return new URL(url).pathname.match(SHORTCODE_PATTERN)?.[1] || null;
    } catch {
        return null;
    }
}

/**
 * Reads a post's caption through Instagram's private web API, as the logged-in agent account.
 *
 * Logged-out requests only get a login page, which is why this needs the session the agent pushes.
 * Network-level failures are thrown as they are; RecipePageScraper classifies them like any page fetch.
 */
class InstagramCaptionFetcher {
    constructor(logger = rootLogger) {
        this.logger = logger;
    }

    async fetchCaption(url) {
        const startedAt = Date.now();
        const session = await InstagramSession.get();
        if (!session?.sessionId) {
            throw new AppError("INSTAGRAM_NOT_CONFIGURED", { details: { url } });
        }

        const headers = this.buildHeaders(session);
        let shortcode = extractShortcode(url);
        if (!shortcode) {
            // Share links (/share/reel/…) only reveal the shortcode after a redirect.
            shortcode = extractShortcode(await this.resolveShareLink(url, headers));
        }
        if (!shortcode) {
            throw new AppError("SOURCE_NOT_FOUND", {
                message: "Instagram link does not point at a post or reel",
                details: { url }
            });
        }

        const mediaId = shortcodeToMediaId(shortcode);
        const response = await axios.get(`https://www.instagram.com/api/v1/media/${mediaId}/info/`, {
            timeout: FETCH_TIMEOUT_MS,
            // A redirect here is always to the login page.
            maxRedirects: 0,
            headers,
            validateStatus: () => true
        });

        const body = response.data;
        const apiMessage = typeof body === "object" ? body?.message : undefined;
        const details = { url, shortcode, mediaId, status: response.status, apiMessage, sessionUpdatedAt: session.updatedAt };

        const loggedOut = response.status === 401
            || (response.status >= 300 && response.status < 400)
            || typeof body !== "object"
            || body?.require_login === true
            || LOGGED_OUT_MESSAGES.includes(apiMessage);
        if (loggedOut) {
            InstagramSession.markExpired();
            throw new AppError("INSTAGRAM_SESSION_EXPIRED", { details });
        }
        if (response.status === 404 || /media not found/i.test(apiMessage || "")) {
            throw new AppError("SOURCE_NOT_FOUND", { message: "Instagram post not found (deleted or private)", details });
        }
        if (response.status === 403 || response.status === 429) {
            throw new AppError("SOURCE_BLOCKED", { message: `Instagram refused the request with ${response.status}`, details });
        }
        if (response.status >= 400) {
            throw new AppError("SOURCE_UNREACHABLE", { message: `Instagram API returned ${response.status}`, details });
        }

        InstagramSession.markWorking();

        const caption = (body?.items?.[0]?.caption?.text || "").trim();
        if (caption.length < MIN_CAPTION_LENGTH) {
            throw new AppError("INSTAGRAM_NO_CAPTION_RECIPE", {
                details: { url, shortcode, captionChars: caption.length, minimumChars: MIN_CAPTION_LENGTH }
            });
        }

        this.logger.info("Fetched Instagram caption", {
            url,
            shortcode,
            captionChars: caption.length,
            durationMs: Date.now() - startedAt
        });
        return caption;
    }

    buildHeaders(session) {
        const cookie = [
            `sessionid=${session.sessionId}`,
            session.csrfToken && `csrftoken=${session.csrfToken}`,
            session.dsUserId && `ds_user_id=${session.dsUserId}`
        ].filter(Boolean).join("; ");

        return {
            // Same UA as the agent's Chrome, so the session is not seen switching browsers.
            "User-Agent": session.userAgent || FALLBACK_USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cookie": cookie,
            "X-IG-App-ID": IG_WEB_APP_ID,
            "X-CSRFToken": session.csrfToken || "",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.instagram.com/"
        };
    }

    async resolveShareLink(url, headers) {
        const response = await axios.get(url, {
            timeout: FETCH_TIMEOUT_MS,
            maxRedirects: 5,
            headers: { ...headers, "Accept": "text/html" },
            responseType: "text",
            validateStatus: () => true
        });
        const finalUrl = response.request?.res?.responseUrl || url;
        this.logger.debug("Resolved Instagram share link", { url, finalUrl, status: response.status });
        return finalUrl;
    }
}

module.exports = { InstagramCaptionFetcher, isInstagramUrl, shortcodeToMediaId, extractShortcode };
