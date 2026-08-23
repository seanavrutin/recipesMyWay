const admin = require("firebase-admin");
const crypto = require("crypto");

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
            if (!admin.apps.length) {
                const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
                if (rawServiceAccount) {
                    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(rawServiceAccount)) });
                } else {
                    admin.initializeApp({ credential: admin.credential.applicationDefault() });
                }
            }
            this._db = admin.firestore();
            // Couchbase dropped undefined fields on serialize; Firestore throws on them instead.
            this._db.settings({ ignoreUndefinedProperties: true });
            console.log("Firestore connected");
        } catch (error) {
            console.error("Firestore connection failed:", error);
        }

        return this._db;
    }

    get db() {
        return this._db || this.connect();
    }

    async saveRecipe(userName, recipeJson, docId) {
        try {
            if (!recipeJson.title) {
                throw new Error("No title found in recipe JSON");
            }
            if (!docId) {
                const uuid = crypto.randomUUID();
                docId = `Recipe_${userName}_${uuid}`;
            }
            const document = {
                recipe: recipeJson,
                userName: userName,
                id: docId
            };
            await this.db.collection(RECIPES_COLLECTION).doc(docId).set(document);

            return document;
        } catch (error) {
            console.error("Error saving recipe:", error);
            return null;
        }
    }

    async saveReadyDoc(docId, json) {
        await this.db.collection(RECIPES_COLLECTION).doc(docId).set(json);
    }

    // Couchbase matched on the document id prefix; Firestore matches the userName field instead,
    // so every recipe document must carry a userName that matches its id segment.
    async getRecipesByUser(userName) {
        try {
            const snapshot = await this.db.collection(RECIPES_COLLECTION).where("userName", "==", userName).get();
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching recipes for user:", error);
            return [];
        }
    }

    async deleteRecipe(docId) {
        try {
            await this.db.collection(RECIPES_COLLECTION).doc(docId).delete();
            return true;
        } catch (error) {
            console.error("Error deleting recipe:", error);
            return false;
        }
    }

    async getUserInfo(userName) {
        try {
            const docId = `User_${userName}`;
            const doc = await this.db.collection(USERS_COLLECTION).doc(docId).get();
            if (!doc.exists) {
                return null;
            }
            return doc.data();
        } catch (error) {
            console.error("Error fetching user info:", error);
            return null;
        }
    }

    async addUser(userName, given_name, family_name) {
        try {
            const docId = `User_${userName}`;
            const userDoc = {
                given_name: given_name,
                family_name: family_name,
                familyMembers: []
            };
            await this.db.collection(USERS_COLLECTION).doc(docId).set(userDoc);
            return userDoc;
        } catch (error) {
            console.error("Error adding user:", error);
            return null;
        }
    }

    async modifyFamilyMember(mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes) {
        try {
            const docId = `User_${mainUser}`;
            const doc = await this.db.collection(USERS_COLLECTION).doc(docId).get();
            if (!doc.exists) {
                return null;
            }
            const userData = doc.data();

            let familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex(member => member.memberName === modifiedFamilyMember);

            if (index !== -1) {
                familyMembers[index].allowedToSeeMyRecipes = allowedToSeeMyRecipes;
                familyMembers[index].allowedToSeeTheirRecipes = allowedToSeeTheirRecipes;
            } else {
                familyMembers.push({ memberName: modifiedFamilyMember, allowedToSeeMyRecipes: allowedToSeeMyRecipes, allowedToSeeTheirRecipes: allowedToSeeTheirRecipes });
            }

            userData.familyMembers = familyMembers;
            await this.db.collection(USERS_COLLECTION).doc(docId).set(userData);
            return userData;
        } catch (error) {
            console.error("Error modifying family member:", error);
            return null;
        }
    }

    async removeFamilyMember(mainUser, modifiedFamilyMember) {
        try {
            const docId = `User_${mainUser}`;
            const doc = await this.db.collection(USERS_COLLECTION).doc(docId).get();
            if (!doc.exists) {
                return null;
            }
            const userData = doc.data();

            let familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex(member => member.memberName === modifiedFamilyMember);

            if (index !== -1) {
                familyMembers.splice(index, 1);
            }

            userData.familyMembers = familyMembers;
            await this.db.collection(USERS_COLLECTION).doc(docId).set(userData);
            return userData;
        } catch (error) {
            console.error("Error modifying family member:", error);
            return null;
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

            return documents;
        } catch (error) {
            console.error("Error fetching documents from Firestore:", error);
            throw error;
        }
    }
}

module.exports = new FirestoreService();
