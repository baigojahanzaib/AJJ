import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// List all active customers (Paginated)
export const list = query({
    args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;
        return await ctx.db
            .query("customers")
            .withIndex("by_isActive", (q) => q.eq("isActive", true))
            .paginate({ cursor: args.cursor ?? null, numItems: limit });
    },
});

// List active customers only (Paginated)
export const listActive = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;
        // Naive pagination for filtered list
        const customers = await ctx.db.query("customers").take(limit);
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
                c.name.toLowerCase().includes(searchTerm) ||
                c.phone.includes(searchTerm) ||
                (c.email && c.email.toLowerCase().includes(searchTerm)) ||
                (c.company && c.company.toLowerCase().includes(searchTerm))
        );
    },
});

// Create a new customer
export const create = mutation({
    args: {
        name: v.string(),
        phone: v.string(),
        email: v.optional(v.string()),
        address: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        company: v.optional(v.string()),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        const customerId = await ctx.db.insert("customers", {
            name: args.name,
            phone: args.phone,
            email: args.email ?? "", // Fallback to empty string if undefined, assuming schema requires string
            address: args.address,
            latitude: args.latitude,
            longitude: args.longitude,
            company: args.company,
            isActive: args.isActive,
            createdAt: new Date().toISOString(),
        });

        // Trigger Ecwid sync if configured (Push to Ecwid)
        // await ctx.scheduler.runAfter(0, api.ecwid.createCustomerInEcwid, { customerId });

        return customerId;
    },
});

// Update a customer
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
        await ctx.db.patch(id, updates);

        // Trigger Ecwid sync if configured (Push updates to Ecwid)
        // await ctx.scheduler.runAfter(0, api.ecwid.updateCustomerInEcwid, { customerId: id });
    },
});

// Delete a customer
export const remove = mutation({
    args: { id: v.id("customers") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});
