/**
 * Every failure the API can produce, in one place.
 *
 * Each entry pins down three things that used to be decided ad hoc at each throw site: the HTTP
 * status the client should see, the Hebrew sentence the user should read, and the log severity.
 * `logLevel: "warn"` means "expected in normal operation, nothing to fix" (a blocked site, a bad
 * request); `"error"` means "someone needs to look at this".
 */
const ERROR_CATALOG = {
    // --- Request validation ---
    VALIDATION_FAILED: {
        httpStatus: 400,
        logLevel: "warn",
        userMessage: "הבקשה חסרה פרטים נדרשים.",
        description: "Request body was missing a required field."
    },
    RECIPE_NO_INPUT: {
        httpStatus: 400,
        logLevel: "warn",
        userMessage: "לא נמצא תוכן לעיבוד. הוסיפו טקסט, קישור או תמונה.",
        description: "No text, url or image was supplied, so there is nothing to send to the model."
    },

    // --- Fetching a recipe from an external website ---
    SOURCE_BLOCKED: {
        httpStatus: 400,
        logLevel: "warn",
        userMessage: "האתר חסום בפני תוכנות אוטומטיות, ולא ניתן לטעון את המתכון ממנו. נסו אתר אחר או העתיקו את המתכון ידנית.",
        description: "The site served a bot-protection challenge (Incapsula/Cloudflare) instead of the page."
    },
    SOURCE_NOT_FOUND: {
        httpStatus: 400,
        logLevel: "warn",
        userMessage: "הקישור לא נמצא. בדקו שהכתובת נכונה ונסו שוב.",
        description: "The source URL returned 404/410."
    },
    SOURCE_TIMEOUT: {
        httpStatus: 504,
        logLevel: "warn",
        userMessage: "האתר לא הגיב בזמן. נסו שוב בעוד רגע או העתיקו את המתכון ידנית.",
        description: "The source site did not respond before the fetch timeout."
    },
    SOURCE_UNREACHABLE: {
        httpStatus: 502,
        logLevel: "warn",
        userMessage: "לא הצלחנו להתחבר לאתר. בדקו את הקישור ונסו שוב.",
        description: "DNS/TLS/connection-level failure while fetching the source URL."
    },
    SOURCE_EMPTY: {
        httpStatus: 422,
        logLevel: "warn",
        userMessage: "לא הצלחנו למצוא תוכן מתכון בקישור הזה. נסו להעתיק את המתכון ידנית.",
        description: "The page loaded but produced too little text to be a recipe."
    },

    // --- Image handling ---
    IMAGE_INVALID: {
        httpStatus: 400,
        logLevel: "warn",
        userMessage: "לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת.",
        description: "sharp could not decode the uploaded file."
    },

    // --- The AI provider ---
    AI_NOT_CONFIGURED: {
        httpStatus: 500,
        logLevel: "error",
        userMessage: "השירות אינו מוגדר כראוי. אנא נסו שוב מאוחר יותר.",
        description: "GEMINI_API_KEY is missing from the environment."
    },
    AI_AUTH_FAILED: {
        httpStatus: 500,
        logLevel: "error",
        userMessage: "השירות אינו מוגדר כראוי. אנא נסו שוב מאוחר יותר.",
        description: "The provider rejected the API key (revoked, wrong project, or restricted)."
    },
    AI_QUOTA_EXCEEDED: {
        httpStatus: 503,
        logLevel: "error",
        userMessage: "השירות הגיע למגבלת השימוש שלו. אנא נסו שוב מאוחר יותר.",
        description: "Billing quota or free-tier allowance is exhausted. Requires operator action, not a retry."
    },
    AI_RATE_LIMITED: {
        httpStatus: 429,
        logLevel: "warn",
        retryable: true,
        userMessage: "יש עומס על השירות כרגע. נסו שוב בעוד רגע.",
        description: "Too many requests per minute; retrying later should succeed."
    },
    AI_TIMEOUT: {
        httpStatus: 504,
        logLevel: "warn",
        retryable: true,
        userMessage: "עיבוד המתכון ארך זמן רב מדי. נסו שוב.",
        description: "The model did not respond before our timeout."
    },
    AI_UNAVAILABLE: {
        httpStatus: 503,
        logLevel: "error",
        retryable: true,
        userMessage: "השירות אינו זמין כרגע. נסו שוב בעוד רגע.",
        description: "Provider returned 500/503, i.e. a fault on their side."
    },
    AI_SAFETY_BLOCKED: {
        httpStatus: 422,
        logLevel: "warn",
        userMessage: "לא הצלחנו לעבד את התוכן הזה. נסו מתכון אחר.",
        description: "The model refused to answer because of its safety filters."
    },
    AI_EMPTY_RESPONSE: {
        httpStatus: 502,
        logLevel: "error",
        userMessage: "מצטערים, לא הצלחנו לעבד את המתכון. נסו שוב.",
        description: "The model returned no candidates or an empty text body."
    },
    AI_TRUNCATED_RESPONSE: {
        httpStatus: 502,
        logLevel: "error",
        userMessage: "המתכון ארוך מדי לעיבוד. נסו לקצר אותו או לחלק אותו לשניים.",
        description: "Generation stopped at the output-token limit, so the JSON was cut off mid-structure."
    },
    AI_INVALID_JSON: {
        httpStatus: 502,
        logLevel: "error",
        userMessage: "מצטערים, לא הצלחנו לעבד את המתכון. נסו שוב.",
        description: "The model's reply was not parseable JSON despite the response schema."
    },
    RECIPE_HANDWRITING_UNSUPPORTED: {
        httpStatus: 422,
        logLevel: "warn",
        userMessage: "מצטערים, מתכונים אשר רשומים בכתב יד לא נתמכים.",
        description: "The model reported the image contains a handwritten recipe."
    },
    RECIPE_NOT_RECOGNIZED: {
        httpStatus: 422,
        logLevel: "warn",
        userMessage: "לא זיהינו מתכון בתוכן שנשלח. בדקו את הקישור או העתיקו את המתכון ידנית.",
        description: "The model could not find a recipe in the supplied content."
    },
    RECIPE_INCOMPLETE: {
        httpStatus: 422,
        logLevel: "warn",
        userMessage: "המתכון שזיהינו חסר פרטים. נסו להעתיק אותו ידנית.",
        description: "The parsed recipe was missing a title or had no ingredients and no instructions."
    },

    // --- Storage ---
    DB_UNAVAILABLE: {
        httpStatus: 503,
        logLevel: "error",
        userMessage: "מסד הנתונים אינו זמין כרגע. נסו שוב בעוד רגע.",
        description: "Firestore could not be initialised or reached."
    },
    DB_READ_FAILED: {
        httpStatus: 500,
        logLevel: "error",
        userMessage: "מצטערים, קרתה תקלה בטעינת הנתונים.",
        description: "A Firestore read failed."
    },
    DB_WRITE_FAILED: {
        httpStatus: 500,
        logLevel: "error",
        userMessage: "מצטערים, קרתה תקלה בשמירת המתכון.",
        description: "A Firestore write failed."
    },
    USER_NOT_FOUND: {
        httpStatus: 404,
        logLevel: "warn",
        userMessage: "המשתמש לא נמצא.",
        description: "No user document exists for the requested userName."
    },

    // --- Backup ---
    BACKUP_FAILED: {
        httpStatus: 500,
        logLevel: "error",
        userMessage: "גיבוי הנתונים נכשל.",
        description: "The Firestore-to-Drive backup pipeline failed."
    },

    // --- Fallback ---
    INTERNAL: {
        httpStatus: 500,
        logLevel: "error",
        userMessage: "מצטערים, קרתה תקלה. נסו שוב.",
        description: "Unclassified failure; the log entry holds the real cause."
    }
};

/**
 * An error that already knows how it should be reported.
 *
 * `code` selects the catalog entry, `details` carries structured context for the log line, and
 * `cause` keeps the original error so nothing is lost on the way up the stack.
 */
class AppError extends Error {
    constructor(code, { message, details, cause, userMessage, httpStatus } = {}) {
        const entry = ERROR_CATALOG[code] || ERROR_CATALOG.INTERNAL;
        super(message || entry.description);

        this.name = "AppError";
        this.code = ERROR_CATALOG[code] ? code : "INTERNAL";
        this.httpStatus = httpStatus || entry.httpStatus;
        this.userMessage = userMessage || entry.userMessage;
        this.logLevel = entry.logLevel;
        this.retryable = Boolean(entry.retryable);
        this.details = details;
        if (cause) this.cause = cause;

        Error.captureStackTrace?.(this, AppError);
    }

    /** Wraps anything thrown by a library into a classified AppError, leaving AppErrors untouched. */
    static from(error, fallbackCode = "INTERNAL", details) {
        if (error instanceof AppError) return error;
        return new AppError(fallbackCode, { message: error?.message, cause: error, details });
    }
}

module.exports = { AppError, ERROR_CATALOG };
