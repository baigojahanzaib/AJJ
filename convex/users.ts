import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";

// Helper to resolve avatar - handles both storage IDs and external URLs
async function resolveAvatarUrl(ctx: QueryCtx, avatar: string | undefined): Promise<string | undefined> {
    if (!avatar) return undefined;
    // If it's a default avatar or already a URL, return as-is or undefined
    if (avatar.startsWith("default-")) return undefined;
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar;
    // Otherwise, treat as Convex storage ID
    try {
        return await ctx.storage.getUrl(avatar) ?? undefined;
    } catch {
        return undefined;
    }
}

// List all users
export const list = query({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();
        return await Promise.all(
            users.map(async (user) => ({
                ...user,
                avatarUrl: await resolveAvatarUrl(ctx, user.avatar),
            }))
        );
    },
});

// Get user by ID
export const getById = query({
    args: { id: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.id);
        if (!user) return null;
        return {
            ...user,
            avatarUrl: await resolveAvatarUrl(ctx, user.avatar),
        };
    },
});

// Get user by email (for authentication)
export const getByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
            .first();

        if (!user) return null;

        return {
            ...user,
            avatarUrl: await resolveAvatarUrl(ctx, user.avatar),
        };
    },
});

// Validate user credentials (for login)
export const validateCredentials = query({
    args: { email: v.string(), password: v.string() },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
            .first();

        if (!user) return null;

        // Simple password check (in production, use proper hashing)
        if (user.passwordHash !== args.password) return null;
        if (!user.isActive) return null;

        // Return user without password
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    },
});

// Create a new user
export const create = mutation({
    args: {
        email: v.string(),
        password: v.string(),
        name: v.string(),
        role: v.union(v.literal("admin"), v.literal("sales_rep")),
        phone: v.string(),
        avatar: v.optional(v.string()),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        const { password, ...rest } = args;
        return await ctx.db.insert("users", {
            ...rest,
            email: args.email.toLowerCase(),
            passwordHash: password, // In production, hash the password
            createdAt: new Date().toISOString(),
        });
    },
});

// Update user
export const update = mutation({
    args: {
        id: v.id("users"),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        password: v.optional(v.string()),
        phone: v.optional(v.string()),
        avatar: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        role: v.optional(v.union(v.literal("admin"), v.literal("sales_rep"))),
    },
    handler: async (ctx, args) => {
        const { id, password, ...updates } = args;

        const finalUpdates: any = { ...updates };

        // Handle password update if provided
        if (password) {
            finalUpdates.passwordHash = password; // In production, hash this
        }

        if (finalUpdates.email) {
            finalUpdates.email = finalUpdates.email.toLowerCase();
        }

        // Filter out undefined values
        const cleanUpdates = Object.fromEntries(
            Object.entries(finalUpdates).filter(([_, v]) => v !== undefined)
        );

        await ctx.db.patch(id, cleanUpdates);
        return await ctx.db.get(id);
    },
});

// Delete/deactivate user
export const remove = mutation({
    args: { id: v.id("users") },
    handler: async (ctx, args) => {
        // Soft delete - just deactivate
        await ctx.db.patch(args.id, { isActive: false });
    },
});

// Hard delete user
export const hardDelete = mutation({
    args: { id: v.id("users") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// Get sales reps only
export const getSalesReps = query({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();
        return users.filter((u) => u.role === "sales_rep");
    },
});

// Reset all passwords to defaults (for development)
export const resetPasswords = mutation({
    args: {},
    handler: async (ctx) => {
        const users = await ctx.db.query("users").collect();

        for (const user of users) {
            const defaultPassword = user.role === "admin" ? "admin123" : "sales123";
            await ctx.db.patch(user._id, { passwordHash: defaultPassword });
        }

        console.log(`[Users] Reset passwords for ${users.length} users`);
        return { success: true, message: `Reset passwords for ${users.length} users` };
    },
});

