const express = require("express");
const router = express.Router();
const CouchbaseService = require("../config/couchbase");
const ChatGPTService = require("../services/ChatGPTService");

// Ensure Couchbase is connected
(async () => {
    await CouchbaseService.connect();
})();

/**
 * Get all recipes for a user
 */
router.get("/recipes/:userName", async (req, res) => {
    const { userName } = req.params;

    try {
        const recipes = await CouchbaseService.getRecipesByUser(userName);
        res.json(recipes);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch recipes" });
    }
});

/**
 * Save a recipe
 */
router.post("/recipes", async (req, res) => {
    const { userName, recipeJson } = req.body;

    if (!userName || !recipeJson) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const docId = await CouchbaseService.saveRecipe(userName, recipeJson);
        if (docId) {
            res.json({ message: `Recipe saved successfully: ${docId}` });
        } else {
            res.status(500).json({ error: "Failed to save recipe" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to save recipe" });
    }
});

/**
 * Add a new user
 */
router.post("/user", async (req, res) => {
    const { userName, given_name, family_name } = req.body;

    if (!userName || !given_name || !family_name) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        let chatGPTService = new ChatGPTService();
        let translatedNames = await chatGPTService.translateNameToHebrew({ given_name, family_name });
        if (!translatedNames) {
            translatedNames = { given_name, family_name }; // Use input names if translation fails
        }

        const doc = await CouchbaseService.addUser(userName, translatedNames.given_name, translatedNames.family_name);
        if (doc) {
            res.json(doc);
        } else {
            res.status(500).json({ error: "Failed to add user" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to add user" });
    }
});

/**
 * Modify a family member's permission
 */
router.put("/user/family", async (req, res) => {
    const { mainUser, modifiedFamilyMember, isAllowed } = req.body;

    if (!mainUser || !modifiedFamilyMember || typeof isAllowed !== "boolean") {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const updatedUser = await CouchbaseService.modifyFamilyMember(mainUser, modifiedFamilyMember, isAllowed);
        if (updatedUser) {
            res.json({ message: "Family member updated successfully", user: updatedUser });
        } else {
            res.status(500).json({ error: "Failed to update family member" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to update family member" });
    }
});

/**
 * Get user information
 */
router.get("/user/:userName", async (req, res) => {
    const { userName } = req.params;

    try {
        const userInfo = await CouchbaseService.getUserInfo(userName);
        if (userInfo) {
            res.json(userInfo);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user information" });
    }
});

module.exports = router;
