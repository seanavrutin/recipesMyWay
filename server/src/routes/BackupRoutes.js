const express = require("express");
const CouchbaseService = require("../config/couchbase");
const ZippingService = require("../services/ZippingService");
const GoogleDriveService = require("../services/GoogleDriveService");

const router = express.Router();
const BACKUP_FOLDER_ID = "1IUa5JpZ9_wvzD2KoamF10lGfH8uMPH7s"; // Replace with your folder ID

router.get("/backup", async (req, res) => {
    try {
        console.log("Starting virtual backup process...");

        // Step 1: Fetch all documents from Couchbase
        const documents = await CouchbaseService.fetchAllDocuments();

        // Step 2: Create a ZIP stream
        const zipStream = ZippingService.createZipStream(documents);

        // Step 3: Upload the ZIP stream to Google Drive
        const fileName = `Couchbase_Backup_${new Date().toISOString().split("T")[0]}.zip`;
        await GoogleDriveService.uploadStream(zipStream, BACKUP_FOLDER_ID, fileName);

        console.log("Backup completed successfully!");
        res.status(200).json({ message: "Backup completed successfully!" });
    } catch (error) {
        console.error("Backup process failed:", error);
        res.status(500).json({ error: "Backup process failed." });
    }
});

module.exports = router;
