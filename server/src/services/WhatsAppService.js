const axios = require("axios");
const { AppError } = require("../utils/AppError");
const { logger: rootLogger } = require("../utils/Logger");

class WhatsAppService {
    /**
     * Sends a WhatsApp message, throwing if delivery fails.
     *
     * Callers depend on this rejecting rather than resolving on failure, since a silently dropped
     * message leaves the user waiting for a reply that will never arrive.
     */
    async sendMessage(to, message, logger = rootLogger) {
        const phoneNumberId = process.env.PHONE_NUMBER_ID;
        const token = process.env.ACCESS_TOKEN;

        if (!phoneNumberId || !token) {
            throw new AppError("INTERNAL", {
                message: "Cannot send a WhatsApp message because the API credentials are not configured",
                details: { hasPhoneNumberId: Boolean(phoneNumberId), hasAccessToken: Boolean(token) }
            });
        }

        const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

        try {
            const response = await axios.post(
                url,
                { messaging_product: "whatsapp", to, text: { body: message } },
                { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
            );

            logger.info("WhatsApp message sent", {
                to,
                messageLength: message.length,
                messageId: response.data?.messages?.[0]?.id
            });
            return response.data;
        } catch (error) {
            const graphError = error.response?.data?.error;
            throw new AppError("INTERNAL", {
                message: `Failed to send a WhatsApp message: ${graphError?.message || error.message}`,
                cause: error,
                details: {
                    to,
                    status: error.response?.status,
                    graphCode: graphError?.code,
                    graphSubcode: graphError?.error_subcode,
                    graphType: graphError?.type
                }
            });
        }
    }
}

module.exports = WhatsAppService;
