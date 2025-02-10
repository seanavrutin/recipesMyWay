const archiver = require("archiver");
const { PassThrough } = require("stream");

class ZippingService {
    static createZipStream(documents) {
        const archive = archiver("zip", { zlib: { level: 9 } }); // Create an archiver instance
        const stream = new PassThrough(); // Create a virtual stream

        archive.pipe(stream); // Pipe archiver data to the virtual stream

        // Add each document as a separate JSON file
        documents.forEach((doc) => {
            const fileName = `${doc.id}.json`; // Use the document ID as the file name
            const content = JSON.stringify(doc, null, 2); // Pretty-print the JSON
            archive.append(content, { name: fileName }); // Add the file to the archive
        });

        archive.finalize(); // Finalize the archive (finish adding files)

        return stream; // Return the stream for further use
    }
}

module.exports = ZippingService;
