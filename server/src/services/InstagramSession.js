const FirestoreService = require("../config/firestore");
const { logger } = require("../utils/Logger");

// The agent on VM 102 pushes a fresh session daily. Two days without one means the agent itself is
// broken (VM down, timer stopped), even if the last session still works.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
// Re-read Firestore at most this often, so a push that reached a different process (or a restart)
// is picked up without a read on every recipe.
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * The Instagram login cookies, pushed by the agent and stored in Firestore `config/instagramSession`.
 *
 * Also tracks whether Instagram last accepted or rejected them, which `/health` reports so an expired
 * session is visible before a user hits it.
 */
class InstagramSession {
    constructor() {
        this.session = null;
        this.loadedAt = 0;
        this.expired = false;
    }

    async get() {
        if (!this.session || Date.now() - this.loadedAt > CACHE_TTL_MS) {
            await this.load();
        }
        return this.session;
    }

    async load() {
        const stored = await FirestoreService.getInstagramSession();
        if (stored?.sessionId !== this.session?.sessionId) {
            this.expired = false;
        }
        this.session = stored;
        this.loadedAt = Date.now();
        return stored;
    }

    async save({ sessionId, csrfToken, dsUserId, userAgent, username }) {
        const session = {
            sessionId,
            csrfToken,
            dsUserId,
            userAgent: userAgent || null,
            username: username || null,
            updatedAt: new Date().toISOString()
        };
        await FirestoreService.saveInstagramSession(session);
        this.session = session;
        this.loadedAt = Date.now();
        this.expired = false;
        return session;
    }

    markExpired() {
        this.expired = true;
    }

    markWorking() {
        this.expired = false;
    }

    /** For `/health`: answered from memory only, never touches Firestore. */
    status() {
        if (!this.session) {
            return { status: "missing" };
        }
        const ageMs = Date.now() - Date.parse(this.session.updatedAt);
        let status = "ok";
        if (this.expired) status = "expired";
        else if (ageMs > STALE_AFTER_MS) status = "stale";
        return { status, updatedAt: this.session.updatedAt, ageHours: Math.round(ageMs / 3600000) };
    }

    /** Called at boot so `/health` is accurate before the first Instagram link arrives. */
    async warm() {
        try {
            await this.load();
            logger.info("Instagram session loaded", this.status());
        } catch (error) {
            logger.error("Could not load the Instagram session at startup; Instagram links will retry the read", { error });
        }
    }
}

module.exports = new InstagramSession();
