const express = require("express");
const router = express.Router();
const FirestoreService = require("../config/firestore");
const GeminiService = require("../services/GeminiService");
const RecipePageScraper = require("../services/RecipePageScraper");
const { AppError } = require("../utils/AppError");
const { asyncRoute } = require("../utils/routeHelpers");
const multer = require("multer");
const sharp = require("sharp");

const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 15 * 1024 * 1024);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });

/**
 * Get all recipes visible to a user: their own, plus those of family members who shared with them.
 */
router.get("/recipes/:userName", asyncRoute(async (req, res) => {
    const { userName } = req.params;

    const userData = await FirestoreService.getUserInfo(userName);
    if (!userData) {
        throw new AppError("USER_NOT_FOUND", { details: { userName } });
    }

    const userNames = [userName];
    if (userData.familyMembers) {
        userData.familyMembers.forEach((member) => {
            if (member.allowedToSeeTheirRecipes) {
                userNames.push(member.memberName);
            }
        });
    }

    let allRecipesDocs = [];
    for (const name of userNames) {
        const recipeDocs = await FirestoreService.getRecipesByUser(name);
        allRecipesDocs = allRecipesDocs.concat(recipeDocs);
    }

    req.log.info("Served recipe list", {
        userName,
        sourceUserCount: userNames.length,
        recipeCount: allRecipesDocs.length
    });
    res.json(allRecipesDocs);
}));

/**
 * Create a recipe from free text, a URL, an uploaded image, or any combination of the three.
 */
router.post("/recipes", upload.single("image"), asyncRoute(async (req, res) => {
    const { userName, text, url } = req.body;

    if (!userName) {
        throw new AppError("VALIDATION_FAILED", {
            message: "userName is required to create a recipe",
            details: { missingFields: ["userName"] }
        });
    }

    req.log.info("Creating recipe", {
        userName,
        hasText: Boolean(text),
        hasUrl: Boolean(url),
        hasImage: Boolean(req.file),
        url
    });

    const image = req.file ? await prepareImage(req.file, req.log) : undefined;

    let scrapedText;
    if (url) {
        scrapedText = await new RecipePageScraper(req.log).scrape(url);
    }

    let modelInput = "";
    if (text && scrapedText) {
        modelInput = `המלל הוא: ${text} והקישור הוא: ${scrapedText}`;
    } else if (text) {
        modelInput = text;
    } else if (scrapedText) {
        modelInput = scrapedText;
    }

    // Checked before the service is constructed, so an empty submission is reported as the user
    // error it is rather than as whatever configuration problem the service finds first.
    if (!modelInput && !image) {
        throw new AppError("RECIPE_NO_INPUT", { details: { userName, hasUrl: Boolean(url) } });
    }

    const gemini = new GeminiService(req.log);
    const formattedRecipe = await gemini.formatRecipe({ text: modelInput, image });
    if (url) {
        formattedRecipe.url = url;
    }

    const document = await FirestoreService.saveRecipe(userName, formattedRecipe, undefined);

    req.log.info("Recipe created", {
        userName,
        docId: document.id,
        title: formattedRecipe.title,
        ingredientCount: formattedRecipe.ingredients.length,
        instructionCount: formattedRecipe.instructions.length
    });
    res.json(document);
}));

router.post("/updateRecipe", asyncRoute(async (req, res) => {
    const { userName, recipe, docId } = req.body;

    if (!userName || !recipe) {
        throw new AppError("VALIDATION_FAILED", {
            message: "userName and recipe are required to update a recipe",
            details: { missingFields: [!userName && "userName", !recipe && "recipe"].filter(Boolean) }
        });
    }

    const document = await FirestoreService.saveRecipe(userName, recipe, docId);
    req.log.info("Recipe updated", { userName, docId: document.id });
    res.json(document);
}));

router.delete("/recipes/:docId", asyncRoute(async (req, res) => {
    const { docId } = req.params;

    await FirestoreService.deleteRecipe(docId);
    req.log.info("Recipe deleted", { docId });
    res.json({ message: `Recipe deleted successfully: ${docId}` });
}));

/**
 * Add a new user, transliterating their name to Hebrew when possible.
 */
router.post("/user", asyncRoute(async (req, res) => {
    const { userName, given_name, family_name } = req.body;

    const missingFields = [!userName && "userName", !given_name && "given_name", !family_name && "family_name"].filter(Boolean);
    if (missingFields.length > 0) {
        throw new AppError("VALIDATION_FAILED", { message: `Missing fields: ${missingFields.join(", ")}`, details: { missingFields } });
    }

    // A failed transliteration must not block signup, so this path deliberately degrades to the
    // original name. It is logged inside the service so the degradation is still visible.
    let translatedNames = { given_name, family_name };
    try {
        const translated = await new GeminiService(req.log).translateNameToHebrew({ given_name, family_name });
        if (translated) {
            translatedNames = translated;
        } else {
            req.log.warn("Storing user with untranslated name", { userName });
        }
    } catch (error) {
        req.log.warn("Storing user with untranslated name after a service failure", { userName, error });
    }

    const doc = await FirestoreService.addUser(userName, translatedNames.given_name, translatedNames.family_name);
    req.log.info("User created", { userName, translated: translatedNames.given_name !== given_name });
    res.json(doc);
}));

router.get("/user/:userName", asyncRoute(async (req, res) => {
    const { userName } = req.params;

    const userInfo = await FirestoreService.getUserInfo(userName);
    if (!userInfo) {
        throw new AppError("USER_NOT_FOUND", { details: { userName } });
    }
    res.json(userInfo);
}));

router.put("/user/family", asyncRoute(async (req, res) => {
    const { mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes } = req.body;

    if (!mainUser || !modifiedFamilyMember) {
        throw new AppError("VALIDATION_FAILED", {
            message: "mainUser and modifiedFamilyMember are required",
            details: { missingFields: [!mainUser && "mainUser", !modifiedFamilyMember && "modifiedFamilyMember"].filter(Boolean) }
        });
    }

    const updatedUser = await FirestoreService.modifyFamilyMember(
        mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes
    );
    if (!updatedUser) {
        throw new AppError("USER_NOT_FOUND", { details: { userName: mainUser } });
    }

    req.log.info("Family member updated", { mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes });
    res.json({ message: "Family member updated successfully", user: updatedUser });
}));

router.post("/user/deleteFamily", asyncRoute(async (req, res) => {
    const { mainUser, modifiedFamilyMember } = req.body;

    if (!mainUser || !modifiedFamilyMember) {
        throw new AppError("VALIDATION_FAILED", {
            message: "mainUser and modifiedFamilyMember are required",
            details: { missingFields: [!mainUser && "mainUser", !modifiedFamilyMember && "modifiedFamilyMember"].filter(Boolean) }
        });
    }

    const updatedUser = await FirestoreService.removeFamilyMember(mainUser, modifiedFamilyMember);
    if (!updatedUser) {
        throw new AppError("USER_NOT_FOUND", { details: { userName: mainUser } });
    }

    req.log.info("Family member removed", { mainUser, modifiedFamilyMember });
    res.json({ message: "Family member removed successfully", user: updatedUser });
}));

async function prepareImage(file, log) {
    try {
        const resized = await sharp(file.buffer).resize({ width: 800 }).jpeg({ quality: 80 }).toBuffer();
        log.debug("Resized uploaded image", {
            originalBytes: file.size,
            resizedBytes: resized.length,
            mimeType: file.mimetype
        });
        return { mimeType: "image/jpeg", base64: resized.toString("base64") };
    } catch (error) {
        throw new AppError("IMAGE_INVALID", {
            message: `Could not decode the uploaded image: ${error.message}`,
            cause: error,
            details: { originalName: file.originalname, mimeType: file.mimetype, bytes: file.size }
        });
    }
}

module.exports = router;
