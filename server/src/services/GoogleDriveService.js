const { google } = require("googleapis");

class GoogleDriveService {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            keyFile: "./credentials.json", // Ensure credentials file path is correct
            scopes: ["https://www.googleapis.com/auth/drive.file"],
        });
        this.drive = google.drive({ version: "v3", auth: this.auth });
    }

    async uploadStream(stream, folderId, fileName) {
        try {
            const fileMetadata = {
                name: fileName, // Name of the file in Google Drive
                parents: ["1IUa5JpZ9_wvzD2KoamF10lGfH8uMPH7s"], 
            };
            const media = {
                mimeType: "application/zip",
                body: stream, // Use the virtual stream as the body
            };

            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: "id",
            });

            console.log(`File uploaded to Google Drive with ID: ${response.data.id}`);
            return response.data.id;
        } catch (error) {
            console.error("Error uploading to Google Drive:", error);
            throw error;
        }
    }
}

module.exports = new GoogleDriveService();
