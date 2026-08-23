require("dotenv").config();
const express = require("express");
const cors = require("cors");

const WebhookRoutes = require("./routes/WebhookRoutes");
const RecipeRoutes = require("./routes/RecipeRoutes");
const BackupRoutes = require("./routes/BackupRoutes");
const FirestoreService = require("./config/firestore");
const { logger } = require("./utils/Logger");
const { requestContext } = require("./middleware/requestContext");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

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

// Checked at boot so a misconfigured deployment is obvious from the first log lines instead of
// only surfacing when a user tries to add a recipe.
const REQUIRED_ENV = ["GEMINI_API_KEY"];
const OPTIONAL_ENV = ["GEMINI_MODEL", "LOG_LEVEL", "LOG_FORMAT", "PORT", "CORS_ALLOWED_ORIGINS", "VERIFY_TOKEN", "PHONE_NUMBER_ID", "ACCESS_TOKEN"];

class App {
    constructor() {
        this.app = express();
        this.checkConfiguration();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
        this.initializeDatabase();
    }

    checkConfiguration() {
        const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
        if (missing.length > 0) {
            logger.error("Missing required environment variables; recipe creation will fail until they are set", {
                missing,
                hint: "Add them to server/.env or the container environment"
            });
        }

        if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
            logger.warn("TLS certificate verification is disabled process-wide", {
                variable: "NODE_TLS_REJECT_UNAUTHORIZED",
                impact: "every outbound HTTPS call, including Gemini and Firestore, accepts invalid certificates",
                hint: "remove it from server/.env unless a self-signed host still requires it"
            });
        }

        logger.info("Configuration loaded", {
            nodeEnv: process.env.NODE_ENV || "development",
            geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash (default)",
            allowedOrigins,
            configured: [...REQUIRED_ENV, ...OPTIONAL_ENV].filter((name) => Boolean(process.env[name])),
            notConfigured: [...REQUIRED_ENV, ...OPTIONAL_ENV].filter((name) => !process.env[name])
        });
    }

    initializeMiddleware() {
        this.app.use(requestContext);

        this.app.use(
            cors({
                origin: (origin, callback) => {
                    // Requests with no origin (mobile apps, Postman, server-to-server) are allowed.
                    if (!origin || allowedOrigins.includes(origin)) {
                        callback(null, true);
                    } else if (origin.startsWith("http://10.100.102.")) {
                        // Allow all IPs in the local 10.100.102.x range.
                        callback(null, true);
                    } else {
                        logger.warn("Blocked CORS request", { origin, allowedOrigins });
                        callback(null, false);
                    }
                },
                exposedHeaders: ["X-Request-Id"]
            })
        );

        this.app.use(express.json({ limit: "2mb" }));
    }

    initializeRoutes() {
        this.app.get("/health", (req, res) => {
            res.json({
                status: "ok",
                uptimeSeconds: Math.round(process.uptime()),
                geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
            });
        });

        this.app.use("/webhook", WebhookRoutes);
        this.app.use("/api", RecipeRoutes);
        this.app.use("/backup", BackupRoutes);
    }

    initializeErrorHandling() {
        this.app.use(notFoundHandler);
        this.app.use(errorHandler);

        // A crash that leaves no log entry is the worst case, so these always write before exiting.
        process.on("unhandledRejection", (reason) => {
            logger.error("Unhandled promise rejection", { error: reason instanceof Error ? reason : new Error(String(reason)) });
        });
        process.on("uncaughtException", (error) => {
            logger.error("Uncaught exception, shutting down", { error });
            // The process state is unknown after this point, so exit and let the container restart.
            process.exit(1);
        });
    }

    initializeDatabase() {
        try {
            FirestoreService.connect();
        } catch (error) {
            logger.error("Firestore is unavailable at startup; requests touching the database will fail", { error });
        }
    }

    listen() {
        const PORT = process.env.PORT || 3000;
        this.app.listen(PORT, () => {
            logger.info(`Server listening on port ${PORT}`, { port: Number(PORT), pid: process.pid, nodeVersion: process.version });
        });
    }
}

const server = new App();
server.listen();
