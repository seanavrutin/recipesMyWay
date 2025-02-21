const couchbase = require('couchbase');

class CouchbaseService {
    constructor() {
        this.cluster = null;
        this.bucket = null;
        this.collection = null;
    }

    async connect() {
        try {
            this.cluster = await couchbase.connect("couchbase://10.100.102.15", {
                username: "Administrator",
                password: "Administrator",
            });

            this.bucket = this.cluster.bucket("Recipes");
            this.collection = this.bucket.defaultCollection();

        } catch (error) {
            console.error("Couchbase connection failed:", error);
        }
    }

    async saveRecipe(userName, recipeJson) {
        try {
            const titleEntry = recipeJson.find(item => item.key === "כותרת");
            if (!titleEntry) {
                throw new Error("No title found in recipe JSON");
            }
            const recipeName = titleEntry.value.replace(/\s+/g, "_"); // Replace spaces with underscores

            const docId = `Recipe_${userName}_${recipeName}`;
            await this.collection.upsert(docId, { recipe: recipeJson });

            return docId;
        } catch (error) {
            console.error("Error saving recipe:", error);
            return null;
        }
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

    async modifyFamilyMember(mainUser, modifiedFamilyMember, isAllowed) {
        try {
            const docId = `User_${mainUser}`;
            const result = await this.collection.get(docId);
            const userData = result.content;

            let familyMembers = userData.familyMembers || [];
            const index = familyMembers.findIndex(member => member.memberName === modifiedFamilyMember);
            
            if (index !== -1) {
                familyMembers[index].allowedToSeeMyRecipes = isAllowed;
            } else {
                familyMembers.push({ memberName: modifiedFamilyMember, allowedToSeeMyRecipes: isAllowed });
            }
            
            userData.familyMembers = familyMembers;
            await this.collection.upsert(docId, userData);
            return userData;
        } catch (error) {
            console.error("Error modifying family member:", error);
            return null;
        }
    }
}

module.exports = new CouchbaseService();
