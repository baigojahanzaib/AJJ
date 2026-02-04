import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const listRecentSyncedOrders = internalQuery({
    args: { limit: v.number() },
    handler: async (ctx, args) => {
        // Fetch recent orders that have an ecwidOrderId
        const orders = await ctx.db.query("orders")
            .withIndex("by_ecwidOrderId")
            // .filter(q => q.neq(q.field("ecwidOrderId"), undefined)) // Not efficient if many
            // Better: Iterate by creation (desc) and filter manually
            .order("desc")
            .take(args.limit * 2); // Take more to account for non-synced ones

        return orders.filter(o => o.ecwidOrderId).slice(0, args.limit);
    }
});
