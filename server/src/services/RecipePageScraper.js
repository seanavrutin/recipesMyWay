const axios = require("axios");
const cheerio = require("cheerio");
const { AppError } = require("../utils/AppError");
const { logger: rootLogger } = require("../utils/Logger");

const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS || 20000);
const MAX_TEXT_LENGTH = Number(process.env.SCRAPE_MAX_CHARS || 60000);
const MIN_TEXT_LENGTH = 120;

// Sites behind these products answer with a challenge page rather than an error status, so the
// giveaway is in the body, not the status code.
const BOT_PROTECTION_MARKERS = [
    "_Incapsula_Resource",
    "Incapsula",
    "Request unsuccessful",
    "Attention Required! | Cloudflare",
    "Checking your browser before accessing",
    "cf-browser-verification",
    "Just a moment...",
    "Enable JavaScript and cookies to continue"
];

// Without a browser-like UA a growing number of sites answer 403.
const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7"
};

const NOISE_SELECTORS = [
    '[id*="comment"]', '[class*="comment"]',
    '[id*="respond"]', '[class*="respond"]',
    '[id*="reply"]', '[class*="reply"]',
    '[id*="discussion"]', '[class*="discussion"]',
    '[id*="reviews"]', '[class*="reviews"]',
    '[id*="feedback"]', '[class*="feedback"]',
    "section.comments", "div.comments",
    "ul.comments", "ol.comments", "aside.comments"
].join(",");

class RecipePageScraper {
    constructor(logger = rootLogger) {
        this.logger = logger;
    }

    /** Fetches a recipe page and returns its readable text, throwing a classified AppError on failure. */
    async scrape(url) {
        const startedAt = Date.now();
        let html;

        try {
            const response = await axios.get(url, {
                timeout: FETCH_TIMEOUT_MS,
                maxRedirects: 5,
                headers: BROWSER_HEADERS,
                responseType: "text",
                // Classify the status ourselves instead of taking a generic axios throw.
                validateStatus: () => true
            });

            this.logger.debug("Fetched recipe page", {
                url,
                status: response.status,
                contentType: response.headers?.["content-type"],
                bytes: typeof response.data === "string" ? response.data.length : undefined,
                durationMs: Date.now() - startedAt
            });

            html = typeof response.data === "string" ? response.data : String(response.data ?? "");

            if (response.status === 404 || response.status === 410) {
                throw new AppError("SOURCE_NOT_FOUND", {
                    message: `Recipe page returned ${response.status}`,
                    details: { url, status: response.status }
                });
            }
            if (response.status === 403 || response.status === 429) {
                throw new AppError("SOURCE_BLOCKED", {
                    message: `Recipe page refused the request with ${response.status}`,
                    details: { url, status: response.status }
                });
            }
            if (response.status >= 400) {
                throw new AppError("SOURCE_UNREACHABLE", {
                    message: `Recipe page returned ${response.status}`,
                    details: { url, status: response.status }
                });
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw this.classifyFetchError(error, url, Date.now() - startedAt);
        }

        const marker = BOT_PROTECTION_MARKERS.find((m) => html.includes(m));
        if (marker) {
            throw new AppError("SOURCE_BLOCKED", {
                message: "Recipe page served a bot-protection challenge",
                details: { url, marker }
            });
        }

        const text = this.extractText(html, url);
        if (text.length < MIN_TEXT_LENGTH) {
            throw new AppError("SOURCE_EMPTY", {
                message: "Recipe page produced too little text to contain a recipe",
                details: { url, extractedChars: text.length, htmlChars: html.length, minimumChars: MIN_TEXT_LENGTH }
            });
        }

        this.logger.info("Extracted recipe text from page", {
            url,
            extractedChars: text.length,
            htmlChars: html.length,
            durationMs: Date.now() - startedAt
        });

        return text;
    }

    extractText(html, url) {
        const $ = cheerio.load(html);

        $(NOISE_SELECTORS).remove();
        $("footer, nav, aside, script, style, noscript, iframe, svg").remove();

        // Instagram renders its caption client-side, so the meta description is the only text available.
        const raw = url.includes("instagram")
            ? ($('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "")
            : $("body").text();

        const collapsed = raw.replace(/\s+/g, " ").trim();
        return collapsed.length > MAX_TEXT_LENGTH ? collapsed.slice(0, MAX_TEXT_LENGTH) : collapsed;
    }

    classifyFetchError(error, url, durationMs) {
        const details = { url, durationMs, axiosCode: error?.code };

        if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT" || /timeout/i.test(error?.message || "")) {
            return new AppError("SOURCE_TIMEOUT", {
                message: `Fetching the recipe page timed out after ${FETCH_TIMEOUT_MS}ms`,
                cause: error,
                details
            });
        }
        if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "EPROTO"].includes(error?.code)
            || /certificate|SSL|TLS/i.test(error?.message || "")) {
            return new AppError("SOURCE_UNREACHABLE", {
                message: `Could not connect to the recipe page: ${error?.code || error?.message}`,
                cause: error,
                details
            });
        }

        return new AppError("SOURCE_UNREACHABLE", {
            message: `Unclassified failure fetching the recipe page: ${error?.message}`,
            cause: error,
            details
        });
    }
}

module.exports = RecipePageScraper;
