const axios = require('axios');

class WhatsAppService {
    sendMessage(from,message) {
        const url = `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`;
        const token = process.env.ACCESS_TOKEN;

        axios
            .post(
                url,
                {
                    messaging_product: 'whatsapp',
                    to: from,
                    text: { body: message },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            .then(() => console.log('Message sent successfully'))
            .catch((err) => console.error('Error sending message:', err));
    }
}

module.exports = WhatsAppService;
