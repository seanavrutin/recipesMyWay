const express = require("express");
const router = express.Router();
const CouchbaseService = require("../config/couchbase");

// Ensure Couchbase is connected
(async () => {
    await CouchbaseService.connect();
})();

/**
 * Get all recipes for a user
 */
router.get("/recipes/:phoneNumber", async (req, res) => {
    const { phoneNumber } = req.params;

    try {
        const recipes = await CouchbaseService.getRecipesByUser(phoneNumber);
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch recipes" });
    }
});

/**
 * Save a recipe
 */
router.post("/recipes", async (req, res) => {
    const { phoneNumber, recipeJson } = req.body;

    if (!phoneNumber || !recipeJson) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const docId = await CouchbaseService.saveRecipe(phoneNumber, recipeJson);
        if (docId) {
            res.json({ message: `Recipe saved successfully: ${docId}` });
        } else {
            res.status(500).json({ error: "Failed to save recipe" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to save recipe" });
    }
});

module.exports = router;
