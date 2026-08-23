const { google } = require("googleapis");
const { AppError } = require("../utils/AppError");
const { logger: rootLogger } = require("../utils/Logger");

const CREDENTIALS_PATH = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || "./credentials.json";

class GoogleDriveService {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: ["https://www.googleapis.com/auth/drive.file"]
        });
        this.drive = google.drive({ version: "v3", auth: this.auth });
    }

    async uploadStream(stream, folderId, fileName, logger = rootLogger) {
        try {
            const response = await this.drive.files.create({
                requestBody: { name: fileName, parents: [folderId] },
                media: { mimeType: "application/zip", body: stream },
                fields: "id"
            });

            logger.info("Uploaded backup to Google Drive", { fileName, fileId: response.data.id, folderId });
            return response.data.id;
        } catch (error) {
            const apiError = error.response?.data?.error;
            throw new AppError("BACKUP_FAILED", {
                message: `Google Drive upload failed: ${apiError?.message || error.message}`,
                cause: error,
                details: {
                    fileName,
                    folderId,
                    credentialsPath: CREDENTIALS_PATH,
                    status: error.response?.status,
                    reason: apiError?.errors?.[0]?.reason
                }
            });
        }
    }
}

module.exports = new GoogleDriveService();
