require('dotenv').config();
const express = require('express');
const WebhookRoutes = require('./routes/WebhookRoutes');
const CouchbaseService = require('./config/couchbase');
const RecipeRoutes = require("./routes/RecipeRoutes");
const BackupRoutes = require("./routes/BackupRoutes");

const cors = require("cors");
const defaultAllowedOrigins = [
    "http://localhost:4000",
    "https://recipesmyway.uk",
    "https://development.recipesmyway.pages.dev",
    "https://recipes.avrux.uk"
];
// CORS_ALLOWED_ORIGINS is a comma-separated list that extends the defaults without a code change.
const allowedOrigins = [
    ...defaultAllowedOrigins,
    ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean)
];



class App {
    constructor() {
        this.app = express();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeDatabase();
    }

    initializeMiddleware() {
        this.app.use(
            cors({
                origin: (origin, callback) => {
                    // Allow requests with no origin (like mobile apps or Postman)
                    if (!origin || allowedOrigins.includes(origin)) {
                        callback(null, true);
                    } else if (origin && origin.startsWith('http://10.100.102.')) {
                        // Allow all IPs in the 10.100.102.x range
                        callback(null, true);
                    } else {
                        console.warn(`Blocked CORS request from origin: ${origin}`);
                        callback(null, false);
                    }
                },
            })
        );

        this.app.use(express.json());
    }

    initializeRoutes() {
        this.app.use('/webhook', WebhookRoutes);
        this.app.use("/api", RecipeRoutes);
        this.app.use("/backup", BackupRoutes);
    }

    async initializeDatabase() {
        await CouchbaseService.connect();
    }

    listen() {
        const PORT = process.env.PORT || 3000;
        this.app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
}

const server = new App();
server.listen();
