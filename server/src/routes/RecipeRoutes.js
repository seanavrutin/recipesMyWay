const express = require("express");
const router = express.Router();
const CouchbaseService = require("../config/couchbase");
const ChatGPTService = require("../services/ChatGPTService");
const RecipeUtils = require("../utils/RecipeUtils");
const cheerio = require('cheerio');
const axios = require('axios');
const multer = require("multer");
const sharp = require("sharp");
const storage = multer.memoryStorage();
const upload = multer({ storage });



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
        let allRecipesDocs = [];
        for (const name of userNames) {
            const recipeDocs = await CouchbaseService.getRecipesByUser(name);
            allRecipesDocs = allRecipesDocs.concat(recipeDocs);
        }
        res.json(allRecipesDocs);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch recipes" });
    }
});

/**
 * Save a recipe
 */
router.post("/recipes", upload.single("image"), async (req, res) => {
    let { userName, text } = req.body;
    const chatGPTService = new ChatGPTService();
    let url;

    if (!userName || !text) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    let imageUrl;
    if(req.file){
        const resizedBuffer = await sharp(req.file.buffer)
        .resize({ width: 800 })
        .jpeg({ quality: 80 })
        .toBuffer();
        const base64 = resizedBuffer.toString("base64");
        imageUrl = `data:image/jpeg;base64,${base64}`;
    }

    try {
        if(text.includes('http')){
            const { data } = await axios.get(text);
            url = text;
            if (data.includes('_Incapsula_Resource') || data.includes('Incapsula') || data.includes('Request unsuccessful')) {
                res.status(400).json({ error: "האתר חסום בפני תוכנות אוטומטיות, ולא ניתן לטעון את המתכון ממנו. נסו אתר אחר או העתיקו את המתכון ידנית." });
                return;
            }

            const $ = cheerio.load(data);
          
            // Remove likely comment sections
            $([
              '[id*="comment"]',
              '[class*="comment"]',
              '[id*="respond"]',
              '[class*="respond"]',
              '[id*="reply"]',
              '[class*="reply"]',
              '[id*="discussion"]',
              '[class*="discussion"]',
              '[id*="reviews"]',
              '[class*="reviews"]',
              '[id*="feedback"]',
              '[class*="feedback"]',
              'section.comments',
              'div.comments',
              'ul.comments',
              'ol.comments',
              'aside.comments'
            ].join(',')).remove();
          
            // Optionally also remove footer, sidebar, etc.
            $('footer, nav, aside, script, style').remove();
          
            // Extract clean text from body
            text = $("body").text();       
        }
    }
    catch(error){
        res.status(400).json({ error: "האתר חסום בפני תוכנות אוטומטיות, ולא ניתן לטעון את המתכון ממנו. נסו אתר אחר או העתיקו את המתכון ידנית." });
        return;
    }
    try{
        const formattedRecipe = await chatGPTService.formatRecipe(text,imageUrl);
        if(url){
            formattedRecipe.url=url;
        }

        const document = await CouchbaseService.saveRecipe(userName, formattedRecipe,undefined);
        if (document) {
            res.json(document);
        } else {
            res.status(500).json({ error: "Failed to save recipe" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to save recipe" });
    }
});

router.post("/updateRecipe", async (req, res) => {
    let { userName,recipe,docId } = req.body;

    try {
        const document = await CouchbaseService.saveRecipe(userName, recipe, docId);
        if (document) {
            res.json(document);
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
