import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all categories
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("categories").collect();
    },
});

// List active categories only
export const listActive = query({
    args: {},
    handler: async (ctx) => {
        const categories = await ctx.db.query("categories").collect();
        return categories.filter((c) => c.isActive);
    },
});

// Get category by ID
export const getById = query({
    args: { id: v.id("categories") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Create a new category
export const create = mutation({
    args: {
        name: v.string(),
        description: v.string(),
        image: v.optional(v.string()),
        parentId: v.optional(v.string()),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("categories", {
            ...args,
            createdAt: new Date().toISOString(),
        });
    },
});

// Update category
export const update = mutation({
    args: {
        id: v.id("categories"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        image: v.optional(v.string()),
        parentId: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );
        await ctx.db.patch(id, cleanUpdates);
        return await ctx.db.get(id);
    },
});

// Delete category
export const remove = mutation({
    args: { id: v.id("categories") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
