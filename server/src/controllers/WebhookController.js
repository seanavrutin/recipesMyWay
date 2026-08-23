const WhatsAppService = require("../services/WhatsAppService");
const GeminiService = require("../services/GeminiService");
const RecipePageScraper = require("../services/RecipePageScraper");
const FirestoreService = require("../config/firestore");
const { AppError } = require("../utils/AppError");
const { logger, newRequestId } = require("../utils/Logger");

const URL_PATTERN = /https?:\/\/\S+/;

class WebhookController {
    constructor() {
        this.whatsAppService = new WhatsAppService();
    }

    async handleMessage(req, res) {
        const log = req.log || logger;
        try {
            const value = req.body?.entry?.[0]?.changes?.[0]?.value;
            const messages = value?.messages;
            if (!messages || messages.length === 0) {
                log.debug("Webhook event carried no messages", { field: req.body?.entry?.[0]?.changes?.[0]?.field });
                return res.sendStatus(200);
            }

            const from = messages[0].from;
            const text = messages[0].text?.body || "";

            log.info("WhatsApp message received", { from, messageType: messages[0].type, textLength: text.length });

            // Acknowledge immediately so WhatsApp does not retry while the model is still working.
            res.sendStatus(200);

            this.processMessage(from, text, log);
        } catch (error) {
            log.error("Failed to handle WhatsApp webhook event", { error });
            if (!res.headersSent) {
                res.sendStatus(500);
            }
        }
    }

    /**
     * Runs after the webhook has been acknowledged, so failures cannot be reported over HTTP.
     * Every outcome is therefore logged and, where possible, sent back to the user in WhatsApp.
     */
    async processMessage(from, text, parentLog) {
        const log = (parentLog || logger).child({ jobId: newRequestId(), source: "whatsapp" });

        try {
            let modelInput = text;
            const match = text.match(URL_PATTERN);
            if (match) {
                modelInput = await new RecipePageScraper(log).scrape(match[0]);
            }

            const recipe = await new GeminiService(log).formatRecipe({ text: modelInput, contextLabel: "whatsapp" });
            if (match) {
                recipe.url = match[0];
            }

            const document = await FirestoreService.saveRecipe(from, recipe);
            log.info("Recipe saved from WhatsApp", { from, docId: document.id, title: recipe.title });

            await this.whatsAppService.sendMessage(from, this.formatRecipeForWhatsApp(recipe), log);
        } catch (error) {
            const appError = AppError.from(error, "INTERNAL");
            if (appError.logLevel === "warn") {
                log.warn(`WhatsApp recipe failed with ${appError.code}`, { from, error: appError, code: appError.code });
            } else {
                log.error(`WhatsApp recipe failed with ${appError.code}`, { from, error: appError, code: appError.code });
            }

            try {
                await this.whatsAppService.sendMessage(from, appError.userMessage, log);
            } catch (sendError) {
                log.error("Could not notify the user about the failure", { from, error: sendError });
            }
        }
    }

    verifyWebhook(req, res) {
        const log = req.log || logger;
        const verifyToken = process.env.VERIFY_TOKEN;
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (!verifyToken) {
            log.error("Cannot verify webhook because VERIFY_TOKEN is not configured");
            return res.status(500).send("Webhook verification is not configured");
        }

        if (mode && token === verifyToken) {
            log.info("Webhook verified successfully", { mode });
            return res.status(200).send(challenge);
        }

        log.warn("Webhook verification rejected", { mode, tokenMatches: token === verifyToken, hasToken: Boolean(token) });
        res.status(403).send("Forbidden");
    }

    formatRecipeForWhatsApp(recipe) {
        let text = `*${recipe.title}*`;

        if (recipe.ingredients?.length) {
            text += "\n\n*מרכיבים:*";
            recipe.ingredients.forEach((ingredient) => { text += `\n- ${ingredient}`; });
        }
        if (recipe.instructions?.length) {
            text += "\n\n*הוראות הכנה:*";
            recipe.instructions.forEach((step, index) => { text += `\n${index + 1}. ${step}`; });
        }
        if (recipe.notes) {
            text += `\n\n*הערות:*\n${recipe.notes}`;
        }

        return text;
    }
}

module.exports = WebhookController;
