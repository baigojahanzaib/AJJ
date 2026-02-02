import { query } from "./_generated/server";
import { v } from "convex/values";

export const find = query({
    args: { sku: v.string() },
    handler: async (ctx, args) => {
        // 1. Try to find as a main product
        const product = await ctx.db
            .query("products")
            .filter(q => q.eq(q.field("sku"), args.sku))
            .first();

        if (product) {
            return {
                foundAs: "MAIN_PRODUCT",
                _id: product._id,
                name: product.name,
                sku: product.sku,
                ecwidId: (product as any).ecwidId,
                lastSyncedAt: (product as any).lastSyncedAt,
                isActive: product.isActive,
                // Check if it's considered "stale"
                staleInfo: {
                    hasEcwidId: (product as any).ecwidId !== undefined,
                    lastSyncedAtType: typeof (product as any).lastSyncedAt
                }
            };
        }

        // 2. Try to find as a variation
        const allProducts = await ctx.db.query("products").collect();
        for (const p of allProducts) {
            if (p.variations) {
                for (const variant of p.variations) {
                    for (const opt of variant.options) {
                        if (opt.sku === args.sku) {
                            return {
                                foundAs: "VARIATION_OPTION",
                                parentProduct: {
                                    _id: p._id,
                                    name: p.name,
                                    ecwidId: (p as any).ecwidId,
                                    lastSyncedAt: (p as any).lastSyncedAt,
                                    isActive: p.isActive
                                },
                                variation: {
                                    id: variant.id,
                                    name: variant.name
                                },
                                option: opt
                            };
                        }
                    }
                }
            }
        }

        return { found: false };
    },
});
