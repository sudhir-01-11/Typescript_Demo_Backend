import "express-session";

declare module "express-session" {
    interface SessionData {
        oauthState?: string;

        user?: {
            id: string;
            name?: string;
            email?: string;
            picture?: string;
        };
    }
}   