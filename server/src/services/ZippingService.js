const archiver = require("archiver");
const { PassThrough } = require("stream");
const { logger: rootLogger } = require("../utils/Logger");

class ZippingService {
    static createZipStream(documents, logger = rootLogger) {
        const archive = archiver("zip", { zlib: { level: 9 } });
        const stream = new PassThrough();

        // An archiver error is emitted asynchronously, so without a listener it would surface as an
        // unhandled 'error' event and take the process down mid-backup.
        archive.on("error", (error) => {
            logger.error("Failed while building the backup archive", { error, documentCount: documents.length });
            stream.destroy(error);
        });
        archive.on("warning", (warning) => {
            logger.warn("Archive warning while building the backup", { error: warning });
        });

        archive.pipe(stream);

        documents.forEach((doc) => {
            archive.append(JSON.stringify(doc, null, 2), { name: `${doc.id}.json` });
        });

        archive.finalize();
        logger.debug("Backup archive stream created", { documentCount: documents.length });

        return stream;
    }
}

module.exports = ZippingService;
