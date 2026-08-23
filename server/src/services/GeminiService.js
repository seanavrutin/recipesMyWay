const { GoogleGenAI, Type } = require("@google/genai");
const { AppError } = require("../utils/AppError");
const { logger: rootLogger } = require("../utils/Logger");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 90000);
// Gemini 3.x models spend part of this budget on internal reasoning before emitting the answer, so
// it needs headroom above the size of the recipe itself or generation stops mid-JSON.
const RECIPE_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 8192);

const ALLOWED_CATEGORIES = [
    "קינוחים", "בשר", "טופו", "פסטה", "דגים", "סלטים", "מרקים", "תוספות", "פשטידות", "מאפים"
];

// A response schema makes the provider guarantee the shape, so the reply never has to be scanned
// for a JSON substring and malformed output stops being a failure mode.
const RECIPE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        // The API rejects an empty string as an enum value, so the success case needs a named
        // sentinel rather than "".
        unsupportedReason: {
            type: Type.STRING,
            enum: ["none", "handwriting", "no_recipe_found"],
            description: "'none' when a recipe was extracted. Otherwise why extraction was not possible."
        },
        title: { type: Type.STRING },
        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
        instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        categories: { type: Type.ARRAY, items: { type: Type.STRING, enum: ALLOWED_CATEGORIES } },
        notes: { type: Type.STRING }
    },
    required: ["unsupportedReason", "title", "ingredients", "instructions", "categories", "notes"],
    propertyOrdering: ["unsupportedReason", "title", "ingredients", "instructions", "categories", "notes"]
};

const NAME_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        given_name: { type: Type.STRING },
        family_name: { type: Type.STRING }
    },
    required: ["given_name", "family_name"],
    propertyOrdering: ["given_name", "family_name"]
};

const RECIPE_INSTRUCTIONS = `אתה מומחה בארגון מתכונים בצורה ברורה ומובנית.
הקלט יכול להיות במלל חופשי (במקרה זה אל תקח שום נתונים מכל מקום אחר, רק מהקלט). הקלט יכול להיות גם קוד html של אתר בו המתכון נמצא, במקרה זה תקח את המתכון רק מהאתר הזה, אל תחפש עוד נתונים במקומות אחרים (אם הקלט מכיל גם מלל, אתה מחויב להשתמש גם בו). הקלט גם יכול להיות תמונה, במקרה זה קח את המתכון רק ממידע שמצוין בתמונה (אם הקלט מכיל גם מלל, אתה מחויב להשתמש גם בו).
את החלק של "categories" תבחר אך ורק מתוך הרשימה הבאה: ${ALLOWED_CATEGORIES.join(",")}. כך שכל מתכון יקבל קטגוריה אחת או יותר.
אם לא מצויינות כמויות למרכיבים, הפעל הגיון בריא והשלם לבד, אך ורק אם זה מובן מאליו מאיך שהטקסט כתוב.
את הפעלים שקיימים בהוראות יש לכתוב בצורת "שם פועל".
את החלק של "notes" יש לקחת מהמתכון במידה והוא מכיל מידע חשוב שהוא לא מרכיבים או הוראות הכנה (כמו גודל תבנית או במקרה והמתכון הוא למספר מנות), יש להשאיר חלק זה כמחרוזת ריקה במידה ואין שום אקסטרה מידע במתכון.
במידה והמתכון בתמונה רשום בכתב יד, החזר unsupportedReason="handwriting" והשאר את שאר השדות ריקים.
במידה ולא נמצא מתכון בקלט, החזר unsupportedReason="no_recipe_found" והשאר את שאר השדות ריקים.
אחרת, החזר unsupportedReason="none" ומלא את שאר השדות.`;

class GeminiService {
    constructor(logger = rootLogger) {
        this.logger = logger;
        this.model = DEFAULT_MODEL;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new AppError("AI_NOT_CONFIGURED", {
                message: "GEMINI_API_KEY is not set; cannot reach the Gemini API",
                details: { expectedEnvVar: "GEMINI_API_KEY" }
            });
        }

        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Turns free text, scraped page text and/or an uploaded image into a structured recipe.
     *
     * Throws a classified AppError on every failure path so the caller can report an accurate
     * status and message instead of one catch-all string.
     */
    async formatRecipe({ text, image, contextLabel = "recipe" }) {
        if (!text && !image) {
            throw new AppError("RECIPE_NO_INPUT", { details: { contextLabel } });
        }

        const parts = [{ text: `${RECIPE_INSTRUCTIONS}\n\nהקלט: ${text || "(אין מלל, ראה תמונה)"}` }];
        if (image) {
            parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
        }

        const response = await this.generate({
            operation: "formatRecipe",
            parts,
            schema: RECIPE_SCHEMA,
            maxOutputTokens: RECIPE_MAX_OUTPUT_TOKENS,
            promptMeta: { inputChars: text ? text.length : 0, hasImage: Boolean(image) }
        });

        const recipe = this.parseJson(response, "formatRecipe");

        if (recipe.unsupportedReason === "handwriting") {
            throw new AppError("RECIPE_HANDWRITING_UNSUPPORTED", { details: { hasImage: Boolean(image) } });
        }
        if (recipe.unsupportedReason === "no_recipe_found") {
            throw new AppError("RECIPE_NOT_RECOGNIZED", {
                details: { inputChars: text ? text.length : 0, hasImage: Boolean(image) }
            });
        }

        const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(Boolean) : [];
        const instructions = Array.isArray(recipe.instructions) ? recipe.instructions.filter(Boolean) : [];

        if (!recipe.title || (ingredients.length === 0 && instructions.length === 0)) {
            throw new AppError("RECIPE_INCOMPLETE", {
                details: {
                    hasTitle: Boolean(recipe.title),
                    ingredientCount: ingredients.length,
                    instructionCount: instructions.length
                }
            });
        }

        return {
            title: recipe.title,
            ingredients,
            instructions,
            categories: Array.isArray(recipe.categories) ? recipe.categories.filter(Boolean) : [],
            notes: recipe.notes || ""
        };
    }

    /** Best-effort Hebrew transliteration of a new user's name; returns null instead of throwing. */
    async translateNameToHebrew({ given_name, family_name }) {
        try {
            const response = await this.generate({
                operation: "translateName",
                parts: [{
                    text: `Translate the following name fields to Hebrew, transliterating where there is no direct translation.\n${JSON.stringify({ given_name, family_name })}`
                }],
                schema: NAME_SCHEMA,
                maxOutputTokens: 2048,
                promptMeta: {}
            });

            const translated = this.parseJson(response, "translateName");
            if (!translated.given_name || !translated.family_name) {
                this.logger.warn("Name translation returned empty fields, keeping original name", {
                    translated
                });
                return null;
            }
            return translated;
        } catch (error) {
            // A failed transliteration is cosmetic, so signup continues with the original name.
            // Logged at warn level so this silent degradation is still traceable.
            this.logger.warn("Name translation failed, falling back to the original name", {
                error,
                code: error instanceof AppError ? error.code : undefined
            });
            return null;
        }
    }

    async generate({ operation, parts, schema, maxOutputTokens, promptMeta }) {
        const startedAt = Date.now();
        this.logger.debug(`Gemini request started: ${operation}`, { model: this.model, ...promptMeta });

        let response;
        try {
            response = await this.client.models.generateContent({
                model: this.model,
                contents: [{ role: "user", parts }],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    maxOutputTokens,
                    temperature: 0.2,
                    httpOptions: { timeout: REQUEST_TIMEOUT_MS }
                }
            });
        } catch (error) {
            throw this.classifyProviderError(error, { operation, durationMs: Date.now() - startedAt });
        }

        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const durationMs = Date.now() - startedAt;

        this.logger.info(`Gemini request completed: ${operation}`, {
            model: this.model,
            durationMs,
            finishReason,
            promptTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount,
            ...promptMeta
        });

        if (response.promptFeedback?.blockReason) {
            throw new AppError("AI_SAFETY_BLOCKED", {
                message: `Gemini blocked the prompt: ${response.promptFeedback.blockReason}`,
                details: { operation, blockReason: response.promptFeedback.blockReason, durationMs }
            });
        }
        if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT" || finishReason === "SPII") {
            throw new AppError("AI_SAFETY_BLOCKED", {
                message: `Gemini stopped generating: ${finishReason}`,
                details: { operation, finishReason, safetyRatings: candidate?.safetyRatings, durationMs }
            });
        }
        if (finishReason === "MAX_TOKENS") {
            throw new AppError("AI_TRUNCATED_RESPONSE", {
                message: "Gemini hit the output token limit, so the JSON is incomplete",
                details: { operation, maxOutputTokens, outputTokens: response.usageMetadata?.candidatesTokenCount, durationMs }
            });
        }

        const text = response.text?.trim();
        if (!text) {
            throw new AppError("AI_EMPTY_RESPONSE", {
                message: "Gemini returned no text content",
                details: { operation, finishReason, candidateCount: response.candidates?.length ?? 0, durationMs }
            });
        }

        return text;
    }

    parseJson(text, operation) {
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new AppError("AI_INVALID_JSON", {
                message: `Gemini returned unparseable JSON for ${operation}: ${error.message}`,
                cause: error,
                details: { operation, responsePreview: text.slice(0, 500), responseLength: text.length }
            });
        }
    }

    /**
     * Maps a provider failure onto a specific error code.
     *
     * An exhausted quota, a revoked key and a provider outage need different responses and
     * different operator actions, so they must not collapse into one generic failure.
     */
    classifyProviderError(error, context) {
        const status = error?.status ?? error?.response?.status;
        const message = String(error?.message || "");
        const details = { ...context, providerStatus: status, providerMessage: message.slice(0, 500) };

        if (error?.name === "AbortError" || error?.name === "TimeoutError" || error?.code === "ETIMEDOUT") {
            return new AppError("AI_TIMEOUT", { message: `Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`, cause: error, details });
        }
        if (status === 401 || status === 403 || /API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
            return new AppError("AI_AUTH_FAILED", { message: `Gemini rejected our credentials: ${message}`, cause: error, details });
        }
        if (status === 429) {
            // Gemini uses 429 for both "too fast" and "allowance gone"; only the latter needs a human.
            const isQuota = /quota|billing|exceeded your current quota|free tier|RESOURCE_EXHAUSTED/i.test(message);
            return new AppError(isQuota ? "AI_QUOTA_EXCEEDED" : "AI_RATE_LIMITED", {
                message: `Gemini returned 429: ${message}`,
                cause: error,
                details
            });
        }
        if (status === 400 && /API key/i.test(message)) {
            return new AppError("AI_AUTH_FAILED", { message: `Gemini rejected our credentials: ${message}`, cause: error, details });
        }
        if (status >= 500 || /UNAVAILABLE|overloaded|INTERNAL/i.test(message)) {
            return new AppError("AI_UNAVAILABLE", { message: `Gemini is unavailable: ${message}`, cause: error, details });
        }
        if (["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN"].includes(error?.code)) {
            return new AppError("AI_UNAVAILABLE", { message: `Could not reach Gemini: ${error.code}`, cause: error, details });
        }

        return new AppError("INTERNAL", { message: `Unclassified Gemini failure: ${message}`, cause: error, details });
    }
}

module.exports = GeminiService;
