const express = require("express");
const router = express.Router();
const CouchbaseService = require("../config/couchbase");
const ChatGPTService = require("../services/ChatGPTService");
const RecipeUtils = require("../utils/RecipeUtils");
const cheerio = require('cheerio');
const axios = require('axios');


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
        // Fetch user information
        const userData = await CouchbaseService.getUserInfo(userName);
        if (!userData) {
            return res.status(404).json({ error: "User not found" });
        }

        // Collect all usernames that should be included in the recipe search
        const userNames = [userName];
        if (userData.familyMembers) {
            userData.familyMembers.forEach(member => {
                if (member.allowedToSeeTheirRecipes) {
                    userNames.push(member.memberName);
                }
            });
        }
        // Fetch all recipes for the user and their allowed family members
        let allRecipes = [];
        for (const name of userNames) {
            const recipes = await CouchbaseService.getRecipesByUser(name);
            allRecipes = allRecipes.concat(recipes);
        }
        res.json(allRecipes);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch recipes" });
    }
});

/**
 * Save a recipe
 */
router.post("/recipes", async (req, res) => {
    let { userName, text } = req.body;
    const recipeUtils = new RecipeUtils();
    const chatGPTService = new ChatGPTService();
    let url;

    if (!userName || !text) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        if(text.includes('http')){
            const { data } = await axios.get(text);
            const $ = cheerio.load(data);
            url = text;
            text = $("body").text();
        }

        const formattedRecipe = await chatGPTService.formatRecipe(text);
        if(url){
            formattedRecipe.push({"key":"קישור","value":url});
        }

        const docId = await CouchbaseService.saveRecipe(userName, formattedRecipe);
        if (docId) {
            res.json(formattedRecipe);
        } else {
            res.status(500).json({ error: "Failed to save recipe" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to save recipe" });
    }
});

router.post("/updateRecipe", async (req, res) => {
    let { userName,recipe } = req.body;

    try {
        const docId = await CouchbaseService.saveRecipe(userName, recipe);
        if (docId) {
            res.json(recipe);
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
    const { mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes } = req.body;

    if (!mainUser || !modifiedFamilyMember || !allowedToSeeMyRecipes || !allowedToSeeTheirRecipes) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const updatedUser = await CouchbaseService.modifyFamilyMember(mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes);
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
 * remove a family member
 */
router.post("/user/deleteFamily", async (req, res) => {
    const { mainUser, modifiedFamilyMember } = req.body;

    if (!mainUser || !modifiedFamilyMember) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const updatedUser = await CouchbaseService.removeFamilyMember(mainUser, modifiedFamilyMember);
        if (updatedUser) {
            res.json({ message: "Family member removed successfully", user: updatedUser });
        } else {
            res.status(500).json({ error: "Failed to remove family member" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to remove family member" });
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

/**
 * Delete a recipe by document ID
 */
router.delete("/recipes/:docId", async (req, res) => {
    const { docId } = req.params;

    try {
        const success = await CouchbaseService.deleteRecipe(docId);
        if (success) {
            res.json({ message: `Recipe deleted successfully: ${docId}` });
        } else {
            res.status(500).json({ error: "Failed to delete recipe" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to delete recipe" });
    }
});


module.exports = router;
