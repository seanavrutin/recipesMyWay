const express = require("express");
const FirestoreService = require("../config/firestore");
const ZippingService = require("../services/ZippingService");
const GoogleDriveService = require("../services/GoogleDriveService");
const { AppError } = require("../utils/AppError");
const { asyncRoute } = require("../utils/routeHelpers");

const router = express.Router();
const BACKUP_FOLDER_ID = process.env.BACKUP_FOLDER_ID || "1IUa5JpZ9_wvzD2KoamF10lGfH8uMPH7s";

router.get("/backup", asyncRoute(async (req, res) => {
    const startedAt = Date.now();
    req.log.info("Starting backup", { folderId: BACKUP_FOLDER_ID });

    const documents = await FirestoreService.fetchAllDocuments();
    const zipStream = ZippingService.createZipStream(documents, req.log);
    const fileName = `Firestore_Backup_${new Date().toISOString().split("T")[0]}.zip`;

    let fileId;
    try {
        fileId = await GoogleDriveService.uploadStream(zipStream, BACKUP_FOLDER_ID, fileName, req.log);
    } catch (error) {
        throw AppError.from(error, "BACKUP_FAILED", { fileName, folderId: BACKUP_FOLDER_ID, documentCount: documents.length });
    }

    req.log.info("Backup completed", {
        fileName,
        fileId,
        documentCount: documents.length,
        durationMs: Date.now() - startedAt
    });
    res.status(200).json({ message: "Backup completed successfully!", fileName, documentCount: documents.length });
}));

module.exports = router;
