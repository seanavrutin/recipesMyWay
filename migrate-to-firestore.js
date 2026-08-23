/**
 * One-time migration script: Couchbase -> Firestore
 *
 * Usage:
 *   npm install
 *   node migrate-to-firestore.js --dry-run     # inspect only, writes nothing
 *   node migrate-to-firestore.js               # perform the migration
 *
 * Environment:
 *   COUCHBASE_URL                 e.g. couchbase://10.100.102.15   (required)
 *   COUCHBASE_USER                defaults to Administrator
 *   COUCHBASE_PASSWORD            defaults to Administrator
 *   COUCHBASE_BUCKET              defaults to Recipes
 *   FIREBASE_PROJECT_ID           defaults to recipesmyway-93aa2
 *   FIREBASE_SERVICE_ACCOUNT_PATH path to the Admin SDK key json
 */

const path = require("path");
const couchbase = require("couchbase");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const DRY_RUN = process.argv.includes("--dry-run");

const COUCHBASE_URL = process.env.COUCHBASE_URL;
const COUCHBASE_USER = process.env.COUCHBASE_USER || "Administrator";
const COUCHBASE_PASSWORD = process.env.COUCHBASE_PASSWORD || "Administrator";
const COUCHBASE_BUCKET = process.env.COUCHBASE_BUCKET || "Recipes";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "recipesmyway-93aa2";
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./recipesmyway-93aa2-firebase-adminsdk-fbsvc-c9d31c262c.json";

const FIRESTORE_BATCH_LIMIT = 500;

// Couchbase resolved recipe ownership from the document id (Recipe_{userName}_{uuid}),
// while Firestore queries the userName field, so the id remains the source of truth here.
function userNameFromRecipeId(docId) {
    const withoutPrefix = docId.slice("Recipe_".length);
    const lastSeparator = withoutPrefix.lastIndexOf("_");
    return lastSeparator === -1 ? withoutPrefix : withoutPrefix.slice(0, lastSeparator);
}

async function fetchCouchbaseDocuments() {
    if (!COUCHBASE_URL) {
        throw new Error("COUCHBASE_URL is not set. Point it at the production cluster before migrating.");
    }

    console.log(`Connecting to Couchbase at ${COUCHBASE_URL} ...`);
    const cluster = await couchbase.connect(COUCHBASE_URL, {
        username: COUCHBASE_USER,
        password: COUCHBASE_PASSWORD,
        timeout: { connectTimeout: 10000 }
    });

    console.log("Fetching all documents ...");
    const result = await cluster.query(`SELECT META().id, * FROM \`${COUCHBASE_BUCKET}\``);
    return result.rows.map((row) => ({ id: row.id, data: row[COUCHBASE_BUCKET] }));
}

function initFirestore() {
    const resolvedPath = path.resolve(SERVICE_ACCOUNT_PATH);
    let serviceAccount;
    try {
        serviceAccount = require(resolvedPath);
    } catch (e) {
        console.error(`\nERROR: Could not read the service account key at ${resolvedPath}`);
        console.error("Download one from the Firebase console:");
        console.error(`  https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/settings/serviceaccounts/adminsdk`);
        console.error("Then set FIREBASE_SERVICE_ACCOUNT_PATH to its location.\n");
        process.exit(1);
    }

    initializeApp({ credential: cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
    return getFirestore();
}

function classify(documents) {
    const recipes = [];
    const users = [];
    const other = [];
    const repaired = [];

    for (const doc of documents) {
        if (!doc.data) {
            other.push(doc);
            continue;
        }

        if (doc.id.startsWith("Recipe_")) {
            const ownerFromId = userNameFromRecipeId(doc.id);
            if (doc.data.userName !== ownerFromId) {
                repaired.push({ id: doc.id, was: doc.data.userName, now: ownerFromId });
            }
            recipes.push({ id: doc.id, data: { ...doc.data, userName: ownerFromId, id: doc.id } });
        } else if (doc.id.startsWith("User_")) {
            users.push({ id: doc.id, data: doc.data });
        } else {
            other.push(doc);
        }
    }

    return { recipes, users, other, repaired };
}

async function writeAll(db, collectionName, entries) {
    let written = 0;

    for (let start = 0; start < entries.length; start += FIRESTORE_BATCH_LIMIT) {
        const chunk = entries.slice(start, start + FIRESTORE_BATCH_LIMIT);
        const batch = db.batch();
        chunk.forEach((entry) => batch.set(db.collection(collectionName).doc(entry.id), entry.data));
        await batch.commit();
        written += chunk.length;
        console.log(`  ${collectionName}: ${written}/${entries.length}`);
    }

    return written;
}

async function migrate() {
    const documents = await fetchCouchbaseDocuments();
    console.log(`Found ${documents.length} documents.\n`);

    const { recipes, users, other, repaired } = classify(documents);

    console.log(`  recipes: ${recipes.length}`);
    console.log(`  users:   ${users.length}`);
    console.log(`  other:   ${other.length}`);

    if (repaired.length) {
        console.log(`\n${repaired.length} recipe(s) had a userName that did not match their document id.`);
        console.log("Firestore queries by userName, so these are being corrected from the id:");
        repaired.forEach((r) => console.log(`  ${r.id}: ${JSON.stringify(r.was)} -> ${r.now}`));
    }

    if (other.length) {
        console.log(`\nDocuments that are neither Recipe_ nor User_ (skipped):`);
        other.forEach((d) => console.log(`  ${d.id}`));
    }

    const oversized = [...recipes, ...users].filter((e) => Buffer.byteLength(JSON.stringify(e.data), "utf8") > 1000000);
    if (oversized.length) {
        console.log(`\nWARNING: ${oversized.length} document(s) exceed the Firestore 1MB limit and will fail:`);
        oversized.forEach((e) => console.log(`  ${e.id}`));
    }

    if (DRY_RUN) {
        console.log("\nDry run complete. Nothing was written.");
        return;
    }

    const db = initFirestore();

    console.log("\nWriting to Firestore ...");
    const recipesWritten = await writeAll(db, "recipes", recipes);
    const usersWritten = await writeAll(db, "users", users);

    console.log(`\nMigration complete.`);
    console.log(`  recipes written: ${recipesWritten}`);
    console.log(`  users written:   ${usersWritten}`);
}

migrate()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Migration failed:", error);
        process.exit(1);
    });
