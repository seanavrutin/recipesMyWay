const { google } = require("googleapis");
const fs = require("fs");

const auth = new google.auth.GoogleAuth({
    keyFile: "./credentials.json", // Ensure this points to your credentials JSON file
    scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

async function uploadTestFile() {
    try {
        // Step 1: Create a text file
        const filePath = "./test.txt";
        fs.writeFileSync(filePath, "This is a test file for Google Drive API.");

        // Step 2: Upload the file to Google Drive
        const fileMetadata = {
            name: "test.txt", // Name of the file on Google Drive
            parents: ["1IUa5JpZ9_wvzD2KoamF10lGfH8uMPH7s"]
        };
        const media = {
            mimeType: "text/plain",
            body: fs.createReadStream(filePath), // Read the file
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: "id", // Retrieve only the file ID
        });

        console.log(`File uploaded successfully with ID: ${response.data.id}`);

        // Step 3: Clean up local file
        fs.unlinkSync(filePath); // Delete the local test file
    } catch (error) {
        console.error("Error uploading the file:", error.message);
    }
}

uploadTestFile();
