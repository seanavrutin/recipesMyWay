const OpenAI = require('openai');

class ChatGPTService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY, // Ensure your API key is set in .env
        });
    }

    async formatRecipe(inputText, imageUrl) {
        try {
            const prompt = `
אתה מומחה בארגון מתכונים בצורה ברורה ומובנית.
הקלט יכול להיות במלל חופשי (במקרה זה אל תקח שום נתונים מכל מקום אחר, רק מהקלט). הקלט יכול להיות גם קוד html של אתר בו המתכון נמצא , במקרה זה תקח את המתכון רק מהאתר הזה, אל תחפש עוד נתונים במקומות אחרים (אם הקלט מכיל גם מלל, אתה מחויב להשתמש גם בו). הקלט גם יכול להיות תמונה, במקרה זה קח את המתכון רק ממידע שמצוין בתמונה (אם הקלט מכיל גם מלל, אתה מחויב להשתמש גם בו), במידה והמתכון הרשום בתמונה רשום בכתב יד אנא החזר שגיאה שנראית ככה: {"error:"מצטערים, מתכונים אשר רשומים בכתב יד לא נתמכים"}.  
ארגן את הקלט לתוך JSON בפורמט הבא:
{
  "title": "שם המתכון",
  "ingredients": ["מרכיב 1","מרכיב 2"],
  "instructions": ["שלב 1","שלב 2"],
  "categories": ["קטגוריה 1","קטגוריה 2"],
  "notes": "הערות מהמתכון"
}
                            
את החלק של "categories" תבחר אך ורק מתוך הרשימה הבאה: קינוחים,בשר,טופו,פסטה,דגים,סלטים,מרקים,תוספות,פשטידות,מאפים. כך שכל מתכון יקבל קטגוריה אחת או יותר. אם לא מצויינות כמויות למרכיבים, הפעל הגיון בריא והשלם לבד, אך ורק אם זה מובן מאילו מאיך שהטקסט כתוב. את הפעלים שקיימים בהוראות יש לכתוב בצורת "שם פועל". את החלק של "notes" יש לקחת מהמתכון במידה והוא מכיל מידע חשוב שהוא לא מרכיבים או הוראות הכנה (כמו גודל תבנית או במקרה והמתכון הוא למספר מנות), ניתן להשאיר חלק זה ריק במידה ואין שום אקסטרה מידע במתכון.
התשובה הסופית צריכה להיות JSON שיכול להתפרסר (כך שבין התווים '{' ו-'}' יהיה אובייקט JSON תקין).
            הקלט: ${inputText}
            `;


            let body;
            if(!imageUrl){
                body = {
                    model: 'gpt-4o',
                    messages: [
                        { 
                            role: 'user', 
                            content: prompt 
                        }
                    ],
                    max_tokens: 700,
                }
            }
            else{
                body = {
                    model: "gpt-4o",
                    messages: [
                      {
                        role: "user",
                        content: [
                          {
                            type: "text",
                            text: prompt
                          },
                          {
                            type: "image_url",
                            image_url: {
                              url: imageUrl
                            }
                          }
                        ]
                      }
                    ],
                    max_tokens: 700
                  }
                  
            }
    
            const response = await this.openai.chat.completions.create(body);

            let recipeText = response.choices[0].message.content.trim();

            const jsonStart = recipeText.indexOf("{");
            const jsonEnd = recipeText.lastIndexOf("}") + 1;
            const jsonText = recipeText.substring(jsonStart, jsonEnd);
            const parsedRecipe = JSON.parse(jsonText);

            return parsedRecipe;    
        } catch (error) {
            console.error('Error formatting recipe:', error.response?.data || error.message);
            return {"error": 'מצטערים, לא הצלחנו לעבד את המתכון.'};
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