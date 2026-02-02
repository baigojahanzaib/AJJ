import { query } from "./_generated/server";

export const findProductsWithVariations = query({
    handler: async (ctx) => {
        const products = await ctx.db.query("products").collect();
        return products
            .filter(p => p.name.includes("Booster"))
            .map(p => ({
                id: p._id,
                ecwidId: p.ecwidId,
                name: p.name,
                variationsCount: p.variations.length,
                firstVariation: p.variations[0]
            }))
            .slice(0, 5);
    },
});
