const OpenAI = require('openai');

class ChatGPTService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is set in .env
        });
    }

    async formatRecipe(inputText) {
        try {
            const prompt = `
אתה מומחה בארגון מתכונים בצורה ברורה ומובנית.
הקלט יכול להיות במלל חופשי (במקרה זה אל תקח שום נתונים מכל מקום אחר, רק מהקלט). הקלט יכול להיות גם קוד html של אתר בו המתכון נמצא , במקרה זה תקח את המתכון רק מהאתר הזה, אל תחפש עוד נתונים במקומות אחרים)            
ארגן את הקלט לתוך JSON בפורמט הבא:
[
  {
    "key": "כותרת",
    "value": "שם המתכון"
  },
  {
    "key": "מרכיבים",
    "value": [
      "מרכיב 1",
      "מרכיב 2"
    ]
  },
  {
    "key": "הוראות הכנה",
    "value": [
      "שלב 1",
      "שלב 2"
    ]
  },
    {
    "key": "קטגוריה",
    "value": "קטגוריה1,קטגוריה2"
  }
]
                            
אם המתכון מכיל מספר מתכונים בתוכו (לדוגמה המתכון הוא מתכון של מרק, אבל יש גם את המתכון לקרוטונים הנלווים למרק), הכנס את הכותרות המתאימות לJSON (רכיבים והוראות הכנה אם קיימים)
את החלק של "קטגוריה" תבחר מתוך הרשימה הבאה: מרקים,סלטים,מנות עיקריות,תוספות,מאפים,קינוחים,לחמים,ארוחות בוקר,משקאות,חטיפים,פסטה,פיצות,דגים,עוף,בקר,טבעוני,צמחוני,ללא גלוטן,חגים. כך שכל מתכון יקבל קטגוריה אחת או יותר, מופרדות על ידי פסיקים. אם לא מצויינות כמויות למרכיבים, הפעל הגיון בריא והשלם לבד, אך ורק אם זה מובן מאילו מאיך שהטקסט כתוב.
התשובה הסופית צריכה להיות JSON שיכול להתפרסר
            הקלט: ${inputText}
            `;
    
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 700,
            });

            let recipeText = response.choices[0].message.content.trim();

            const jsonStart = recipeText.indexOf("[");
            const jsonEnd = recipeText.lastIndexOf("]") + 1;
            const jsonText = recipeText.substring(jsonStart, jsonEnd);
            const parsedRecipe = JSON.parse(jsonText);

            return parsedRecipe;    
        } catch (error) {
            console.error('Error formatting recipe:', error.response?.data || error.message);
            return 'מצטער, לא הצלחתי לעבד את המתכון.';
        }
    }

    async translateNameToHebrew(inputJson) {
      try {
          const prompt = `Translate the following name fields to Hebrew and return only JSON:
          ${JSON.stringify(inputJson)}`;

          const response = await this.openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 100,
          });

          let responseText = response.choices[0].message.content.trim();

            const jsonStart = responseText.indexOf("{");
            const jsonEnd = responseText.lastIndexOf("}") + 1;
            const jsonText = responseText.substring(jsonStart, jsonEnd);
            return JSON.parse(jsonText);
      } catch (error) {
          console.error('Error translating name:', error.response?.data || error.message);
          return null;
      }
  }
}

module.exports = ChatGPTService;