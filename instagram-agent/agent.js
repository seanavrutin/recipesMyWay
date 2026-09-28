/**
 * Instagram agent. Runs once a day on VM 102 (systemd user timer), in a real, visible Chrome.
 *
 * Keeps a dedicated Chrome profile logged into the recipes Instagram account and pushes its session
 * cookies to the RecipesMyWay server, which uses them to read post captions. When Instagram has
 * logged the profile out, it logs in again by itself, reading any emailed security code from the
 * account's Gmail over IMAP. Anything it cannot get past (CAPTCHA, suspended account, unknown screen)
 * ends in a screenshot and one alert to ALERT_WEBHOOK_URL.
 *
 *   node agent.js            check/refresh the login and push the session
 *   node agent.js --dry-run  same, but do not push
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright-core");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const DRY_RUN = process.argv.includes("--dry-run");
const CODE_WAIT_MS = 3 * 60 * 1000;
const MAX_LOGIN_STEPS = 12;
const SCREENSHOTS_KEPT = 5;

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set (see agent.env.example)`);
    return value;
}

// Filled in by main(), so a missing setting is reported through the normal failure path.
const CONFIG = {};

function loadConfig() {
    Object.assign(CONFIG, {
        igUsername: required("IG_USERNAME"),
        igPassword: required("IG_PASSWORD"),
        gmailUser: required("GMAIL_USER"),
        gmailAppPassword: required("GMAIL_APP_PASSWORD"),
        recipesApiUrl: process.env.RECIPES_API_URL || "http://10.0.0.41:3000",
        agentToken: DRY_RUN ? process.env.INSTAGRAM_AGENT_TOKEN : required("INSTAGRAM_AGENT_TOKEN"),
        profileDir: process.env.CHROME_PROFILE_DIR || path.join(os.homedir(), ".local/share/instagram-agent/chrome-profile"),
        stateDir: path.join(os.homedir(), ".local/state/instagram-agent")
    });
}

/** A situation that needs a human. Alerted with the message as-is. */
class StuckError extends Error {}

function log(message, fields) {
    const suffix = fields ? ` ${JSON.stringify(fields)}` : "";
    console.log(`${new Date().toISOString()} ${message}${suffix}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Human-ish pacing; Instagram watches for instant, perfectly regular actions.
const pause = (min, max) => sleep(min + Math.random() * (max - min));
const typingDelay = () => 60 + Math.random() * 90;

async function main() {
    loadConfig();
    fs.mkdirSync(CONFIG.stateDir, { recursive: true });
    log("Agent run started", { dryRun: DRY_RUN, profileDir: CONFIG.profileDir });

    const context = await chromium.launchPersistentContext(CONFIG.profileDir, {
        channel: "chrome",
        headless: false,
        locale: "en-US",
        viewport: null,
        // Drop the switches that make the browser announce it is automated.
        ignoreDefaultArgs: ["--enable-automation"],
        args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--no-default-browser-check", "--window-size=1280,900"]
    });
    const page = context.pages()[0] || await context.newPage();

    try {
        await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
        await pause(3000, 6000);

        if (await isLoggedIn(page)) {
            log("Session still valid");
        } else {
            log("Logged out, logging in");
            await login(page);
            if (!(await isLoggedIn(page))) throw new StuckError("Login flow finished but Instagram still reports the profile as logged out");
            log("Logged in");
        }

        // A short look at the feed, the way a person's daily visit would.
        await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
        await pause(2000, 4000);
        await page.mouse.wheel(0, 800 + Math.random() * 1200);
        await pause(2000, 5000);

        const session = await readSession(context, page);
        if (DRY_RUN) {
            log("Dry run, not pushing the session", { dsUserId: session.dsUserId });
        } else {
            await pushSession(session);
        }
    } catch (error) {
        const screenshot = await saveScreenshot(page);
        log("Agent run failed", { error: error.message, url: pagePath(page), screenshot });
        await sendAlert(error instanceof StuckError
            ? `Needs you: ${error.message}. Screenshot on VM 102: ${screenshot}`
            : `Failed: ${error.message}. Screenshot on VM 102: ${screenshot}`);
        error.alerted = true;
        throw error;
    } finally {
        await context.close();
    }
    log("Agent run finished");
}

const LOGGED_OUT_PATHS = /\/accounts\/login|\/challenge|\/auth_platform|\/accounts\/suspended/;

async function hasSessionCookie(page) {
    const cookies = await page.context().cookies("https://www.instagram.com");
    return cookies.some((cookie) => cookie.name === "sessionid" && cookie.value);
}

/**
 * Asks Instagram, since a cookie can outlive its session: the account settings page only opens for a
 * logged-in session and redirects everyone else to the login page. (The /accounts/current_user API
 * that used to answer this now returns an HTML page.) Navigates, so never call it mid-login.
 */
async function isLoggedIn(page) {
    if (!(await hasSessionCookie(page))) return false;
    await page.goto("https://www.instagram.com/accounts/edit/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await pause(2500, 4000);
    const loggedIn = !LOGGED_OUT_PATHS.test(pagePath(page))
        && (await page.locator('input[name="password"], input[name="pass"]').count()) === 0;
    if (!loggedIn) log("Instagram does not accept the session", { landedOn: pagePath(page) });
    return loggedIn;
}

/** Passive check for use inside the login flow: judges the current page without navigating. */
async function looksLoggedIn(page) {
    return (await hasSessionCookie(page))
        && !LOGGED_OUT_PATHS.test(pagePath(page))
        && (await page.locator('input[name="password"], input[name="pass"]').count()) === 0;
}

/**
 * Logs in, then walks through whatever Instagram puts in the way: a security-code challenge, the
 * "save login info" and notification prompts. Stops with a StuckError on anything it can't handle.
 */
async function login(page) {
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await pause(2000, 4000);
    await clickIfVisible(page, /allow all cookies|decline optional cookies/i);

    // On a known device Instagram usually offers a one-click login for the saved account.
    if (await clickIfVisible(page, /continue as/i)) {
        log("Used the saved 'Continue as' login");
    } else {
        const usernameInput = page.locator('input[name="username"], input[name="email"]').first();
        await usernameInput.waitFor({ timeout: 20000 });
        await usernameInput.click();
        await usernameInput.pressSequentially(CONFIG.igUsername, { delay: typingDelay() });
        await pause(400, 900);
        const passwordInput = page.locator('input[name="password"], input[name="pass"]').first();
        await passwordInput.click();
        await passwordInput.pressSequentially(CONFIG.igPassword, { delay: typingDelay() });
        await pause(500, 1200);
        await passwordInput.press("Enter");
        log("Submitted username and password");
    }

    // Codes must be newer than this, so an old email is never reused.
    let codesAfter = Date.now() - 60 * 1000;
    let codesEntered = 0;

    for (let step = 0; step < MAX_LOGIN_STEPS; step++) {
        await pause(4000, 7000);
        const text = await page.locator("body").innerText().catch(() => "");

        if (/password (you entered )?was incorrect|incorrect password|wasn't right/i.test(text)) {
            throw new StuckError("Instagram says the password is wrong. Update IG_PASSWORD in agent.env");
        }
        if (/suspended|disabled your account|appeal/i.test(text)) {
            throw new StuckError("Instagram suspended or disabled the account");
        }
        if (await page.locator('iframe[src*="recaptcha"], iframe[src*="captcha"], iframe[title*="captcha" i]').count()) {
            throw new StuckError("Instagram is showing a CAPTCHA");
        }
        if (/selfie|video of yourself|upload a photo/i.test(text)) {
            throw new StuckError("Instagram wants a selfie/photo verification");
        }

        // The current "Check your email" page (/auth_platform/codeentry) has a plain input labelled "Code".
        const codeInput = page.getByLabel(/^(security )?code$/i)
            .or(page.locator('input[name="security_code"], input[name="verificationCode"], input[autocomplete="one-time-code"], input[inputmode="numeric"]'))
            .first();
        if (await codeInput.isVisible().catch(() => false)) {
            if (codesEntered >= 2) throw new StuckError("Instagram rejected the emailed security code twice");
            log("Instagram asks for a security code, waiting for the email");
            const code = await waitForEmailCode(codesAfter);
            codesAfter = Date.now();
            await codeInput.fill("");
            await codeInput.pressSequentially(code, { delay: 150 });
            await pause(600, 1200);
            if (!(await clickIfVisible(page, /^(confirm|submit|continue|next)$/i))) await codeInput.press("Enter");
            codesEntered++;
            log("Entered the security code");
            // The code page lingers for a few seconds after an accepted code; looking again too soon
            // mistakes it for a rejection and waits for an email that never comes.
            await codeInput.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
            continue;
        }

        // Challenge pages that first ask where to send the code.
        if (await clickIfVisible(page, /send (security )?code|get code|send login code/i)) {
            codesAfter = Date.now() - 30 * 1000;
            log("Asked Instagram to email a security code");
            continue;
        }

        // Saving the login is what makes "Continue as" available next time.
        if (await clickIfVisible(page, /^save info$|^save login info$/i)) continue;
        if (await clickIfVisible(page, /^not now$/i)) continue;

        if (await looksLoggedIn(page)) return;
    }

    throw new StuckError(`Unrecognised Instagram screen during login (${pagePath(page)})`);
}

/** URL without its query; challenge URLs carry kilobytes of opaque state. */
function pagePath(page) {
    return page.url().split("?")[0];
}

async function clickIfVisible(page, name) {
    const target = page.getByRole("button", { name }).or(page.getByRole("link", { name })).first();
    if (!(await target.isVisible().catch(() => false))) return false;
    await pause(500, 1500);
    await target.click();
    return true;
}

async function waitForEmailCode(after) {
    const deadline = Date.now() + CODE_WAIT_MS;
    while (Date.now() < deadline) {
        const code = await findEmailCode(after);
        if (code) return code;
        await sleep(15000);
    }
    throw new StuckError(`No Instagram security code reached ${CONFIG.gmailUser} within ${CODE_WAIT_MS / 60000} minutes`);
}

/** Newest 6-digit code from an Instagram email received after `after`, or null. */
async function findEmailCode(after) {
    const client = new ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user: CONFIG.gmailUser, pass: CONFIG.gmailAppPassword },
        logger: false
    });
    await client.connect();
    try {
        const lock = await client.getMailboxLock("INBOX");
        try {
            // IMAP SINCE is day-granular, so filter the exact time below.
            const uids = await client.search({ from: "instagram", since: new Date(after - 24 * 60 * 60 * 1000) }, { uid: true });
            for (const uid of (uids || []).reverse().slice(0, 10)) {
                const message = await client.fetchOne(uid, { source: true, internalDate: true }, { uid: true });
                if (!message || message.internalDate.getTime() < after) continue;
                const parsed = await simpleParser(message.source);
                const text = `${parsed.subject || ""}\n${parsed.text || ""}`;
                // Prefer a number next to the word "code"; a bare 6-digit match is the fallback.
                const code = text.match(/code\D{0,40}(\d{6})\b/i)?.[1] || text.match(/\b(\d{6})\b/)?.[1];
                if (code) {
                    log("Found security code email", { subject: parsed.subject, receivedAt: message.internalDate.toISOString() });
                    return code;
                }
            }
        } finally {
            lock.release();
        }
    } finally {
        await client.logout().catch(() => {});
    }
    return null;
}

async function readSession(context, page) {
    const cookies = await context.cookies("https://www.instagram.com");
    const value = (name) => cookies.find((cookie) => cookie.name === name)?.value;
    const session = {
        sessionId: value("sessionid"),
        csrfToken: value("csrftoken"),
        dsUserId: value("ds_user_id"),
        // The server sends the same User-Agent, so Instagram sees one browser using the session.
        userAgent: await page.evaluate(() => navigator.userAgent),
        // The login name (the account's email); Instagram's own username isn't needed anywhere.
        username: CONFIG.igUsername
    };
    if (!session.sessionId || !session.csrfToken || !session.dsUserId) {
        throw new Error("Logged in, but the sessionid/csrftoken/ds_user_id cookies are incomplete");
    }
    return session;
}

async function pushSession(session) {
    const response = await fetch(`${CONFIG.recipesApiUrl}/agent/instagram-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CONFIG.agentToken}` },
        body: JSON.stringify(session),
        signal: AbortSignal.timeout(30000)
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Recipes server refused the session: HTTP ${response.status} ${body.slice(0, 200)}`);
    log("Pushed session to recipes server", { status: response.status, response: body.slice(0, 200) });
}

async function saveScreenshot(page) {
    try {
        const file = path.join(CONFIG.stateDir, `failure-${new Date().toISOString().replace(/[:.]/g, "-")}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const old = fs.readdirSync(CONFIG.stateDir).filter((name) => name.startsWith("failure-")).sort().slice(0, -SCREENSHOTS_KEPT);
        old.forEach((name) => fs.rmSync(path.join(CONFIG.stateDir, name), { force: true }));
        return file;
    } catch (error) {
        return `(screenshot failed: ${error.message})`;
    }
}

async function sendAlert(message) {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
        log("No ALERT_WEBHOOK_URL set, alert not sent", { message });
        return;
    }
    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Instagram agent (recipes)", message }),
            signal: AbortSignal.timeout(15000)
        });
        log("Alert sent");
    } catch (error) {
        log("Alert could not be sent", { error: error.message });
    }
}

main().catch(async (error) => {
    // Failures before the page existed (Chrome would not start, bad config) are not alerted yet.
    if (!error.alerted) {
        log("Agent could not run", { error: error.message });
        await sendAlert(`Could not run: ${error.message}`);
    }
    process.exitCode = 1;
});
