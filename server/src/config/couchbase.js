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

            console.log("Connected to Couchbase successfully!");
        } catch (error) {
            console.error("Couchbase connection failed:", error);
        }
    }

    /**
     * Save a recipe to Couchbase
     * @param {string} phoneNumber - User's phone number
     * @param {Array} recipeJson - Recipe JSON
     * @returns {string|null} - Document ID or null if failed
     */
    async saveRecipe(phoneNumber, recipeJson) {
        try {
            const titleEntry = recipeJson.find(item => item.key === "כותרת");
            if (!titleEntry) {
                throw new Error("No title found in recipe JSON");
            }
            const recipeName = titleEntry.value.replace(/\s+/g, "_"); // Replace spaces with underscores

            const docId = `${phoneNumber}_${recipeName}`;
            await this.collection.upsert(docId, { recipe: recipeJson });

            console.log(`Recipe saved: ${docId}`);
            return docId;
        } catch (error) {
            console.error("Error saving recipe:", error);
            return null;
        }
    }

    /**
     * Get all recipes for a specific user
     * @param {string} phoneNumber - User's phone number
     * @returns {Promise<Array>} - List of recipes
     */
    async getRecipesByUser(phoneNumber) {
        try {
            const query = `SELECT META(r).id, r.* 
                           FROM \`Recipes\` r 
                           WHERE META(r).id LIKE '${phoneNumber}_%'`;
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

    async fetchAllDocuments() {
        try {
            const query = `SELECT META().id, * FROM \`Recipes\``;
            const result = await this.cluster.query(query);
            return result.rows; // Return all documents
        } catch (error) {
            console.error("Error fetching documents from Couchbase:", error);
            throw error;
        }
    }
}

module.exports = new CouchbaseService();
