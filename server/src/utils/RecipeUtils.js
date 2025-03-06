class RecipeUtils {
    constructor() {
    }
    
    formatRecipe(recipes) {
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

module.exports = RecipeUtils;