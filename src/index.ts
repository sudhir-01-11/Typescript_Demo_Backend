import dotenv from "dotenv";

dotenv.config();

import express, { Request, Response } from "express";
import session from "express-session";
import { OAuth2Client } from "google-auth-library";

const app = express();

const PORT = process.env.PORT || 3000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_CALLBACK_URL ||
    !SESSION_SECRET
) {
    throw new Error("Missing OAuth environment variables");
}

const oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
);

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        }
    })
);

// Home
app.get("/", (req: Request, res: Response) => {
    res.send(`
        <h1>TypeScript OAuth Demo</h1>
        <p>Bhayya i created this basic demo project using typescript</p>
        <a href="/auth/google">Login with Google</a>
    `);
});

// Start Google OAuth
app.get("/auth/google", (req: Request, res: Response) => {
    const state = Math.random().toString(36).substring(2);

    req.session.oauthState = state;

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "openid",
            "email",
            "profile"
        ],
        include_granted_scopes: true,
        state
    });

    res.redirect(authorizationUrl);
});

// Google OAuth callback
app.get(
    "/auth/google/callback",
    async (req: Request, res: Response) => {
        try {
            const { code, state } = req.query;

            if (!code || typeof code !== "string") {
                return res.status(400).send("Missing authorization code");
            }

            if (!state || state !== req.session.oauthState) {
                return res.status(400).send("Invalid OAuth state");
            }

            delete req.session.oauthState;

            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.id_token) {
                return res.status(400).send("No ID token received");
            }

            const ticket = await oauth2Client.verifyIdToken({
                idToken: tokens.id_token,
                audience: GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();

            if (!payload) {
                return res.status(400).send("Could not get user information");
            }

            req.session.user = {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                picture: payload.picture
            };

            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("OAuth login failed");
        }
    }
);

// Profile
app.get("/profile", (req: Request, res: Response) => {
    if (!req.session.user) {
        return res.status(401).send(`
            <h1>Not logged in</h1>
            <a href="/auth/google">Login with Google</a>
        `);
    }

    const user = req.session.user;

    res.json({
        message: "OAuth login successful!",
        user
    });
});

// Logout
app.get("/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});