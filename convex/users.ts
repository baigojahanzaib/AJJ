import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all users
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("users").collect();
    },
});

// Get user by ID
export const getById = query({
    args: { id: v.id("users") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Get user by email (for authentication)
export const getByEmail = query({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
            .first();
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
        phone: v.optional(v.string()),
        avatar: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        role: v.optional(v.union(v.literal("admin"), v.literal("sales_rep"))),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        // Filter out undefined values
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );
        await ctx.db.patch(id, cleanUpdates);
        return await ctx.db.get(id);
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
