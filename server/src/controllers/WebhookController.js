const WhatsAppService = require('../services/WhatsAppService');
const ChatGPTService = require('../services/ChatGPTService');
const CouchbaseService = require("../config/couchbase");
const axios = require('axios');
const cheerio = require('cheerio');

class WebhookController {
    constructor() {
        this.whatsAppService = new WhatsAppService();
        this.chatGPTService = new ChatGPTService();
    }

    async handleMessage(req, res) {
        try {
            const { messages } = req.body.entry[0].changes[0].value || {};
            if (!messages || messages.length === 0) return res.sendStatus(200);
    
            const from = messages[0].from; // User's phone number
            let text = messages[0].text?.body || '';
    
            console.log(`Received message: ${text}`);
    
            // ✅ Immediately acknowledge the request
            res.sendStatus(200);
    
            // ✅ Process message asynchronously to prevent WhatsApp retries
            this.processMessage(from, text);
        } catch (error) {
            console.error("Error handling message:", error);
            res.sendStatus(500); // Respond with error if needed
        }
    }

    async processMessage(from, text) {
        try {
            if(text.includes('http')){
                const { data } = await axios.get(text);
                const $ = cheerio.load(data);
                text = $("body").text();
            }

            const formattedRecipe = await this.chatGPTService.formatRecipe(text);

            const docId = await CouchbaseService.saveRecipe(from, formattedRecipe);

            if (docId) {
                await this.whatsAppService.sendMessage(from, this.formatRecipeForWhatsApp(formattedRecipe));
            } else {
                await this.whatsAppService.sendMessage(from, `שגיאה בשמירת המתכון.`);
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    }

    verifyWebhook(req, res) {
        const verifyToken = process.env.VERIFY_TOKEN;

        // Meta sends `hub.verify_token` for verification
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token === verifyToken) {
            console.log('Webhook verified successfully.');
            return res.status(200).send(challenge); // Respond with the challenge token
        }

        res.status(403).send('Forbidden');
    }

    formatRecipeForWhatsApp(recipes) {
        let formattedText = "";
        let currentTitle = "";
    
        recipes.forEach(item => {
            if (item.key === "כותרת") {
                // Start a new section for each title
                if (formattedText) formattedText += "\n\n"; // Add spacing between recipes
                formattedText += `*${item.value}*`; // Bold title
                currentTitle = item.value;
            } else if (item.key === "מרכיבים") {
                formattedText += `\n\n*מרכיבים:*`;
                item.value.forEach(ingredient => {
                    formattedText += `\n- ${ingredient}`;
                });
            } else if (item.key === "הוראות הכנה") {
                formattedText += `\n\n*הוראות הכנה:*`;
                item.value.forEach((step, index) => {
                    formattedText += `\n${index + 1}. ${step}`;
                });
            }
        });
    
        return formattedText;
    }
}

module.exports = WebhookController;