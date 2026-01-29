
import { internalQuery } from "./_generated/server";

export const testUpsertQuery = internalQuery({
    args: {},
    handler: async (ctx) => {
        // Replicate upsertOrderFromEcwid read
        // Ecwid ID might be string or number
        const ecwidOrderId = 123456;
        const existing = await ctx.db
            .query("orders")
            .withIndex("by_ecwidOrderId", (q) => q.eq("ecwidOrderId", ecwidOrderId))
            .first();
        return existing;
    },
});
