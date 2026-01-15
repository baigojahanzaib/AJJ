import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Internal mutation to clear database
export const clearAllData = internalMutation({
    args: {},
    handler: async (ctx) => {
        const tables = ["users", "categories", "products", "customers", "orders", "ecwidSettings"] as const;
        for (const table of tables) {
            const records = await ctx.db.query(table).collect();
            for (const record of records) {
                await ctx.db.delete(record._id);
            }
        }
    },
});

// Internal mutation to seed initial data
export const seedInitialData = internalMutation({
    args: {},
    handler: async (ctx) => {
        // Seed Admin User
        await ctx.db.insert("users", {
            email: "admin@company.com",
            passwordHash: "admin123",
            name: "Administrator",
            role: "admin",
            phone: "+1 (555) 100-0001",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
            isActive: true,
            createdAt: new Date().toISOString(),
        });

        // Seed Ecwid Settings
        await ctx.db.insert("ecwidSettings", {
            storeId: "32555156",
            accessToken: "secret_KTawLq5R9xb2PfxX5ynP2uMV5k2igWES",
            autoSyncEnabled: true,
            syncIntervalHours: 24,
        });
    },
});

// Main action to orchestrate the reset and sync
export const resetAndSetup = action({
    args: {},
    handler: async (ctx): Promise<any> => {
        console.log("Starting full reset and setup...");

        // 1. Clear Database
        await ctx.runMutation(internal.setup.clearAllData, {});
        console.log("Database cleared.");

        // 2. Seed Data
        await ctx.runMutation(internal.setup.seedInitialData, {});
        console.log("Initial data seeded.");

        // 3. Trigger Full Sync
        // We call the public action ecwid:fullSync
        console.log("Triggering Ecwid sync...");
        const result: any = await ctx.runAction(api.ecwid.fullSync, {});
        console.log("Sync complete:", result);

        return { success: true, result };
    },
});
