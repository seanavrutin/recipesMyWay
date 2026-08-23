const admin = require("firebase-admin");
const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const { logger } = require("../utils/Logger");

const RECIPES_COLLECTION = "recipes";
const USERS_COLLECTION = "users";

class FirestoreService {
    constructor() {
        this._db = null;
    }

    // Credentials come either as raw JSON in FIREBASE_SERVICE_ACCOUNT (simplest for Docker)
    // or via GOOGLE_APPLICATION_CREDENTIALS pointing at a key file.
    connect() {
        if (this._db) {
            return this._db;
        }

        try {
            // Named to avoid the logger's secret-key redaction, which would mask a plain
            // description of which mechanism was used.
            let authMethod;
            if (!admin.apps.length) {
                const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
                if (rawServiceAccount) {
                    authMethod = "FIREBASE_SERVICE_ACCOUNT env var";
                    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawServiceAccount)) });
                } else {
                    authMethod = process.env.GOOGLE_APPLICATION_CREDENTIALS
                        ? `key file at ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
                        : "application default credentials";
                    admin.initializeApp({ credential: admin.credential.applicationDefault() });
                }
            } else {
                authMethod = "already initialised";
            }
            this._db = admin.firestore();
            // Couchbase dropped undefined fields on serialize; Firestore throws on them instead.
            this._db.settings({ ignoreUndefinedProperties: true });

            logger.info("Firestore connected", {
                authMethod,
                projectId: admin.app().options?.projectId || process.env.GOOGLE_CLOUD_PROJECT || "resolved from credentials"
            });
        } catch (error) {
            // Must throw rather than leave _db null, otherwise the next query fails with an
            // unrelated "cannot read property collection of null" far from the real cause.
            throw new AppError("DB_UNAVAILABLE", {
                message: `Firestore initialisation failed: ${error.message}`,
                cause: error,
                details: {
                    hasServiceAccountEnv: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
                    hasCredentialsPath: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS)
                }
            });
        }

        return this._db;
    }

    get db() {
        return this._db || this.connect();
    }

    async saveRecipe(userName, recipeJson, docId) {
        if (!recipeJson?.title) {
            throw new AppError("RECIPE_INCOMPLETE", {
                message: "Refusing to save a recipe with no title",
                details: { userName, docId, receivedKeys: Object.keys(recipeJson || {}) }
            });
        }

        const id = docId || `Recipe_${userName}_${crypto.randomUUID()}`;
        const document = { recipe: recipeJson, userName, id };

        try {
            await this.db.collection(RECIPES_COLLECTION).doc(id).set(document);
            return document;
        } catch (error) {
            throw new AppError("DB_WRITE_FAILED", {
                message: `Failed to save recipe: ${error.message}`,
                cause: error,
                details: { userName, docId: id, isUpdate: Boolean(docId), grpcCode: error.code }
            });
        }
    }

    async saveReadyDoc(docId, json) {
        try {
            await this.db.collection(RECIPES_COLLECTION).doc(docId).set(json);
        } catch (error) {
            throw new AppError("DB_WRITE_FAILED", {
                message: `Failed to save document ${docId}: ${error.message}`,
                cause: error,
                details: { docId, grpcCode: error.code }
            });
        }
    }

    // Couchbase matched on the document id prefix; Firestore matches the userName field instead,
    // so every recipe document must carry a userName that matches its id segment.
    async getRecipesByUser(userName) {
        try {
            const snapshot = await this.db.collection(RECIPES_COLLECTION).where("userName", "==", userName).get();
            return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            throw new AppError("DB_READ_FAILED", {
                message: `Failed to fetch recipes for ${userName}: ${error.message}`,
                cause: error,
                details: { userName, collection: RECIPES_COLLECTION, grpcCode: error.code }
            });
        }
    }

    async deleteRecipe(docId) {
        try {
            await this.db.collection(RECIPES_COLLECTION).doc(docId).delete();
            return true;
        } catch (error) {
            throw new AppError("DB_WRITE_FAILED", {
                message: `Failed to delete recipe ${docId}: ${error.message}`,
                cause: error,
                details: { docId, grpcCode: error.code }
            });
        }
    }

    /** Returns null when the user does not exist; throws when the read itself fails. */
    async getUserInfo(userName) {
        const docId = `User_${userName}`;
        try {
            const doc = await this.db.collection(USERS_COLLECTION).doc(docId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            throw new AppError("DB_READ_FAILED", {
                message: `Failed to fetch user ${userName}: ${error.message}`,
                cause: error,
                details: { userName, docId, grpcCode: error.code }
            });
        }
    }

    async addUser(userName, given_name, family_name) {
        const docId = `User_${userName}`;
        const userDoc = { given_name, family_name, familyMembers: [] };

        try {
            await this.db.collection(USERS_COLLECTION).doc(docId).set(userDoc);
            return userDoc;
        } catch (error) {
            throw new AppError("DB_WRITE_FAILED", {
                message: `Failed to add user ${userName}: ${error.message}`,
                cause: error,
                details: { userName, docId, grpcCode: error.code }
            });
        }
    }

    async modifyFamilyMember(mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes) {
        const docId = `User_${mainUser}`;
        try {
            const doc = await this.db.collection(USERS_COLLECTION).doc(docId).get();
            if (!doc.exists) {
                return null;
            }
            const userData = doc.data();

            const familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex((member) => member.memberName === modifiedFamilyMember);

            if (index !== -1) {
                familyMembers[index].allowedToSeeMyRecipes = allowedToSeeMyRecipes;
                familyMembers[index].allowedToSeeTheirRecipes = allowedToSeeTheirRecipes;
            } else {
                familyMembers.push({ memberName: modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes });
            }

            userData.familyMembers = familyMembers;
            await this.db.collection(USERS_COLLECTION).doc(docId).set(userData);
            return userData;
        } catch (error) {
            throw new AppError("DB_WRITE_FAILED", {
                message: `Failed to modify family member for ${mainUser}: ${error.message}`,
                cause: error,
                details: { mainUser, modifiedFamilyMember, docId, grpcCode: error.code }
            });
        }
    }

    async removeFamilyMember(mainUser, modifiedFamilyMember) {
        const docId = `User_${mainUser}`;
        try {
            const doc = await this.db.collection(USERS_COLLECTION).doc(docId).get();
            if (!doc.exists) {
                return null;
            }
            const userData = doc.data();

            const familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex((member) => member.memberName === modifiedFamilyMember);
            if (index !== -1) {
                familyMembers.splice(index, 1);
            }

            userData.familyMembers = familyMembers;
            await this.db.collection(USERS_COLLECTION).doc(docId).set(userData);
            return userData;
        } catch (error) {
            throw new AppError("DB_WRITE_FAILED", {
                message: `Failed to remove family member for ${mainUser}: ${error.message}`,
                cause: error,
                details: { mainUser, modifiedFamilyMember, docId, grpcCode: error.code }
            });
        }
    }

    async fetchAllDocuments() {
        try {
            const [recipesSnapshot, usersSnapshot] = await Promise.all([
                this.db.collection(RECIPES_COLLECTION).get(),
                this.db.collection(USERS_COLLECTION).get()
            ]);

            const documents = [];
            recipesSnapshot.docs.forEach((doc) => documents.push({ id: doc.id, ...doc.data() }));
            usersSnapshot.docs.forEach((doc) => documents.push({ id: doc.id, ...doc.data() }));

            logger.debug("Fetched all documents for backup", {
                recipeCount: recipesSnapshot.size,
                userCount: usersSnapshot.size
            });
            return documents;
        } catch (error) {
            throw new AppError("DB_READ_FAILED", {
                message: `Failed to fetch all documents: ${error.message}`,
                cause: error,
                details: { grpcCode: error.code }
            });
        }
    }
}

module.exports = new FirestoreService();
