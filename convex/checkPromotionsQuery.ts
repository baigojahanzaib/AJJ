import { query } from "./_generated/server";
import { api } from "./_generated/api";

export const test = query({
    args: {},
    handler: async (ctx) => {
        // Call the new byRibbon query
        const promotionProducts = await ctx.db
            .query("products")
            .withIndex("by_ribbon", (q) => q.eq("ribbon", "Promotion"))
            .collect();

        return {
            count: promotionProducts.length,
            firstProduct: promotionProducts[0] ? {
                name: promotionProducts[0].name,
                ribbon: promotionProducts[0].ribbon
            } : null
        };
    },
});
