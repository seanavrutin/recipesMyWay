const couchbase = require('couchbase');

class CouchbaseService {
    constructor() {
        this.cluster = null;
        this.bucket = null;
        this.collection = null;
    }

    async connect() {
        try {
            this.cluster = await couchbase.connect(process.env.COUCHBASE_URL, {
                username: "Administrator",
                password: "Administrator",
                timeout: {
                    connectTimeout: 10000 // 10 seconds
                  }
            });

            this.bucket = this.cluster.bucket("Recipes");
            this.collection = this.bucket.defaultCollection();

        } catch (error) {
            console.error("Couchbase connection failed:", error);
        }
    }

    async saveRecipe(userName, recipeJson, docId) {
        try {
            if (!recipeJson.title) {
                throw new Error("No title found in recipe JSON");
            }
            if(!docId){
                const uuid = crypto.randomUUID();
                docId = `Recipe_${userName}_${uuid}`;
            }
            const document = {
                recipe: recipeJson,
                userName: userName,
                id: docId
            }
            await this.collection.upsert(docId, document);

            return document;
        } catch (error) {
            console.error("Error saving recipe:", error);
            return null;
        }
    }

    async saveReadyDoc(docId, json) {
        await this.collection.upsert(docId, json);
    }
    

    async getRecipesByUser(userName) {
        try {
            const query = `SELECT META(r).id, r.* 
                           FROM \`Recipes\` r 
                           WHERE META(r).id LIKE 'Recipe_${userName}_%'`;
            const result = await this.cluster.query(query);
            return result.rows.map(row => ({
                id: row.id,
                ...row,
            }));
        } catch (error) {
            console.error("Error fetching recipes for user:", error);
            return [];
        }
    }

    async deleteRecipe(docId) {
        try {
            await this.collection.remove(docId);
            return true;
        } catch (error) {
            console.error("Error deleting recipe:", error);
            return false;
        }
    }

    async getUserInfo(userName) {
        try {
            const docId = `User_${userName}`;
            const result = await this.collection.get(docId);
            return result.content;
        } catch (error) {
            console.error("Error fetching user info:", error);
            return null;
        }
    }

    async addUser(userName, given_name, family_name ) {
        try {
            const docId = `User_${userName}`;
            const userDoc = {
                given_name: given_name,
                family_name: family_name,
                familyMembers: []
            };
            await this.collection.upsert(docId, userDoc);
            return userDoc;
        } catch (error) {
            console.error("Error adding user:", error);
            return null;
        }
    }

    async modifyFamilyMember(mainUser, modifiedFamilyMember, allowedToSeeMyRecipes, allowedToSeeTheirRecipes) {
        try {
            const docId = `User_${mainUser}`;
            const result = await this.collection.get(docId);
            const userData = result.content;

            let familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex(member => member.memberName === modifiedFamilyMember);
            
            if (index !== -1) {
                familyMembers[index].allowedToSeeMyRecipes = allowedToSeeMyRecipes;
                familyMembers[index].allowedToSeeTheirRecipes = allowedToSeeTheirRecipes;
            } else {
                familyMembers.push({ memberName: modifiedFamilyMember, allowedToSeeMyRecipes: allowedToSeeMyRecipes, allowedToSeeTheirRecipes: allowedToSeeTheirRecipes });
            }
            
            userData.familyMembers = familyMembers;
            await this.collection.upsert(docId, userData);
            return userData;
        } catch (error) {
            console.error("Error modifying family member:", error);
            return null;
        }
    }

    async removeFamilyMember(mainUser, modifiedFamilyMember) {
        try {
            const docId = `User_${mainUser}`;
            const result = await this.collection.get(docId);
            const userData = result.content;

            let familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex(member => member.memberName === modifiedFamilyMember);
            
            if (index !== -1) {
                familyMembers.splice(index, 1);
            }
            
            userData.familyMembers = familyMembers;
            await this.collection.upsert(docId, userData);
            return userData;
        } catch (error) {
            console.error("Error modifying family member:", error);
            return null;
        }
    }

    async fetchAllDocuments() {
        try {
            const query = `SELECT META().id, * FROM \`Recipes\``;
            const result = await this.cluster.query(query);
            return result.rows;
        } catch (error) {
            console.error("Error fetching documents from Couchbase:", error);
            throw error;
        }
    }
}

module.exports = new CouchbaseService();
