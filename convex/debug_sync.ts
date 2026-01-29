import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const testSync = internalAction({
    args: {},
    handler: async (ctx) => {
        const pendingIds: Id<"orders">[] = [
            "jh72greva4feha808844kzt3ws804msf" as Id<"orders">,
            "jh7bba20xfzp8agda20d6t4a9n804e1h" as Id<"orders">
        ];

        for (const orderId of pendingIds) {
            try {
                const order = await ctx.runQuery(api.orders.getById, { id: orderId });
                console.log(`Checking order ${orderId} (${order?.orderNumber}). Email: "${order?.customerEmail}"`);

                console.log("Attempting to sync...");
                await ctx.runAction(api.ecwid.syncOrderToEcwid, { orderId });
                console.log("Sync successful!");
            } catch (e) {
                console.error(`Sync failed for ${orderId} with error:`, e);
            }
        }
    }
});
