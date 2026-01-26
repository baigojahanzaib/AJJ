import { mutation } from "./_generated/server";

// Seed the database with initial data (admin user + Ecwid settings only)
export const seedDatabase = mutation({
    args: {},
    handler: async (ctx) => {
        // Check if data already exists
        const existingUsers = await ctx.db.query("users").first();
        if (existingUsers) {
            return { success: false, message: "Database already seeded" };
        }

        // Seed Admin User only
        await ctx.db.insert("users", {
            email: "admin@company.com",
            passwordHash: "admin123",
            name: "Administrator",
            role: "admin" as const,
            phone: "+1 (555) 100-0001",
            avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
            isActive: true,
            createdAt: new Date().toISOString(),
        });

        // Seed Ecwid Settings
        await ctx.db.insert("ecwidSettings", {
            storeId: "32555156",
            accessToken: "secret_tR1hfT1NMpvhighzXFKJAPKv928rASkX",
            autoSyncEnabled: true,
            syncIntervalHours: 24,
        });

        return { success: true, message: "Database seeded with admin user and Ecwid settings" };
    },
});

// Clear all data (for development reset)
export const clearDatabase = mutation({
    args: {},
    handler: async (ctx) => {
        // Delete all data from each table
        const tables = ["users", "categories", "products", "customers", "orders", "ecwidSettings"] as const;

        for (const table of tables) {
            const records = await ctx.db.query(table).collect();
            for (const record of records) {
                await ctx.db.delete(record._id);
            }
        }

        return { success: true, message: "All data cleared" };
    },
});
