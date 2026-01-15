import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List all active products
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("products").collect();
    },
});

// List active products only
export const listActive = query({
    args: {},
    handler: async (ctx) => {
        const products = await ctx.db.query("products").collect();
        return products.filter((p) => p.isActive);
    },
});

// Get product by ID
export const getById = query({
    args: { id: v.id("products") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Get products by category
export const byCategory = query({
    args: { categoryId: v.string() },
    handler: async (ctx, args) => {
        const products = await ctx.db
            .query("products")
            .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
            .collect();
        return products.filter((p) => p.isActive);
    },
});

// Search products
export const search = query({
    args: { query: v.string() },
    handler: async (ctx, args) => {
        const searchTerm = args.query.toLowerCase();
        const products = await ctx.db.query("products").collect();
        return products.filter(
            (p) =>
                p.isActive &&
                (p.name.toLowerCase().includes(searchTerm) ||
                    p.description.toLowerCase().includes(searchTerm) ||
                    p.sku.toLowerCase().includes(searchTerm))
        );
    },
});

// Variation validators
const variationOptionValidator = v.object({
    id: v.string(),
    name: v.string(),
    priceModifier: v.number(),
    sku: v.string(),
    moq: v.optional(v.number()),
    stock: v.number(),
    image: v.optional(v.string()),
});

const productVariationValidator = v.object({
    id: v.string(),
    name: v.string(),
    options: v.array(variationOptionValidator),
});

// Create a new product
export const create = mutation({
    args: {
        name: v.string(),
        description: v.string(),
        sku: v.string(),
        basePrice: v.number(),
        images: v.array(v.string()),
        categoryId: v.string(),
        isActive: v.boolean(),
        variations: v.array(productVariationValidator),
        stock: v.number(),
        moq: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("products", {
            ...args,
            createdAt: new Date().toISOString(),
        });
    },
});

// Update product
export const update = mutation({
    args: {
        id: v.id("products"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        sku: v.optional(v.string()),
        basePrice: v.optional(v.number()),
        images: v.optional(v.array(v.string())),
        categoryId: v.optional(v.string()),
        isActive: v.optional(v.boolean()),
        variations: v.optional(v.array(productVariationValidator)),
        stock: v.optional(v.number()),
        moq: v.optional(v.number()),
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

// Delete product (soft delete by setting isActive to false)
export const remove = mutation({
    args: { id: v.id("products") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { isActive: false });
    },
});

// Hard delete product
export const hardDelete = mutation({
    args: { id: v.id("products") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

// Batch update MOQ
export const batchUpdateMOQ = mutation({
    args: {
        updates: v.array(
            v.object({
                ecwidId: v.number(),
                sku: v.string(),
                moq: v.number(),
            })
        ),
    },
    handler: async (ctx, args) => {
        const results = [];
        for (const update of args.updates) {
            // Find product by Ecwid ID
            const product = await ctx.db
                .query("products")
                .withIndex("by_ecwidId", (q) => q.eq("ecwidId", update.ecwidId))
                .first();

            if (!product) {
                results.push({ sku: update.sku, success: false, message: "Product not found" });
                continue;
            }

            // Check if SKU matches main product
            if (product.sku === update.sku) {
                await ctx.db.patch(product._id, { moq: update.moq });
                results.push({ sku: update.sku, success: true, type: "product" });
            } else {
                // Check variations
                let variationUpdated = false;
                const updatedVariations = product.variations.map((variation) => {
                    const updatedOptions = variation.options.map((option) => {
                        if (option.sku === update.sku) {
                            variationUpdated = true;
                            return { ...option, moq: update.moq };
                        }
                        return option;
                    });
                    return { ...variation, options: updatedOptions };
                });

                if (variationUpdated) {
                    await ctx.db.patch(product._id, { variations: updatedVariations });
                    results.push({ sku: update.sku, success: true, type: "variation" });
                } else {
                    results.push({ sku: update.sku, success: false, message: "SKU not found in product or variations" });
                }
            }
        }
        return results;
    },
});
