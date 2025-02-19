require('dotenv').config();
const express = require('express');
const WebhookRoutes = require('./routes/WebhookRoutes');
const CouchbaseService = require('./config/couchbase');
const RecipeRoutes = require("./routes/RecipeRoutes");
const BackupRoutes = require("./routes/BackupRoutes");

const cors = require("cors");
const allowedOrigins = ["http://localhost:4000", "http://10.100.102.5:4000","https://recipesmyway.uk"];



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
                    } else {
                        callback(new Error("Not allowed by CORS"));
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
