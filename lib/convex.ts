import { ConvexReactClient } from "convex/react";

// Initialize the Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
    console.warn(
        "[Convex] EXPO_PUBLIC_CONVEX_URL is not set. Convex features will not work."
    );
}

export const convex = new ConvexReactClient(convexUrl || "");
