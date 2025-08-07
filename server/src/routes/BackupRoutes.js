const express = require("express");
const fs = require("fs");
const multer = require("multer");
const unzipper = require("unzipper");
const path = require("path");
const upload = multer({ dest: "uploads/" });

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

router.post("/uploadFromBackup", upload.single("backupZip"), async (req, res) => {
    const zipPath = req.file?.path;
    if (!zipPath) return res.status(400).send("No zip file uploaded.");
  
    const extractDir = path.join("uploads", `extracted_${Date.now()}`);
    fs.mkdirSync(extractDir);
  
    // Extract ZIP
    await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: extractDir })).promise();
  
    const files = fs.readdirSync(extractDir);
    let successCount = 0, errorCount = 0;
  
    for (const fileName of files) {
      try {
        const filePath = path.join(extractDir, fileName);
        const content = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(content);
        const docId = path.basename(fileName, ".json");

        await CouchbaseService.saveReadyDoc(docId, json)
  
        successCount++;
      } catch (err) {
        console.error(`Error processing ${fileName}:`, err.message);
        errorCount++;
      }
    }
  
    // Cleanup
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  
    res.json({ uploaded: successCount, failed: errorCount });
  });

module.exports = router;
