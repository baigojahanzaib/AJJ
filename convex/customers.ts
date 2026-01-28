import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// List all customers
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("customers").collect();
    },
});

// List active customers only
export const listActive = query({
    args: {},
    handler: async (ctx) => {
        const customers = await ctx.db.query("customers").collect();
        return customers.filter((c) => c.isActive);
    },
});

// Get customer by ID
export const getById = query({
    args: { id: v.id("customers") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Search customers
export const search = query({
    args: { query: v.string() },
    handler: async (ctx, args) => {
        const searchTerm = args.query.toLowerCase();
        const customers = await ctx.db.query("customers").collect();
        return customers.filter(
            (c) =>
                c.isActive &&
                (c.name.toLowerCase().includes(searchTerm) ||
                    c.company?.toLowerCase().includes(searchTerm) ||
                    c.phone.includes(searchTerm) ||
                    c.email.toLowerCase().includes(searchTerm))
        );
    },
});

// Create a new customer
export const create = mutation({
    args: {
        name: v.string(),
        phone: v.string(),
        email: v.string(),
        address: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        company: v.optional(v.string()),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        const customerId = await ctx.db.insert("customers", {
            ...args,
            createdAt: new Date().toISOString(),
        });

        // Trigger Ecwid sync
        await ctx.scheduler.runAfter(0, api.ecwid.createCustomerInEcwid, { customerId });

        return customerId;
    },
});

// Update customer
export const update = mutation({
    args: {
        id: v.id("customers"),
        name: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
        address: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        company: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );
        await ctx.db.patch(id, cleanUpdates);

        // Trigger Ecwid sync
        await ctx.scheduler.runAfter(0, api.ecwid.updateCustomerInEcwid, { customerId: id });

        return await ctx.db.get(id);
    },
});

// Delete customer (soft delete)
export const remove = mutation({
    args: { id: v.id("customers") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { isActive: false });
    },
});
