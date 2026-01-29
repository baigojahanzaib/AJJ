import { internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const fixAndSync = internalAction({
    args: {},
    handler: async (ctx) => {
        const pendingIds: Id<"orders">[] = [
            "jh72greva4feha808844kzt3ws804msf" as Id<"orders">,
            "jh7bba20xfzp8agda20d6t4a9n804e1h" as Id<"orders">
        ];

        for (const orderId of pendingIds) {
            const order = await ctx.runQuery(api.orders.getById, { id: orderId });
            if (!order) continue;

            let email = order.customerEmail;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email || !emailRegex.test(email)) {
                const newEmail = email ? `${email.replace(/\s+/g, '')}@example.com` : "customer@example.com";
                console.log(`Fixing email for ${orderId}: "${email}" -> "${newEmail}"`);

                // Update the order in Convex
                await ctx.runMutation(internal.sync_orders.updateOrderEmail, {
                    orderId,
                    email: newEmail
                });
            }

            console.log(`Retrying sync for ${orderId}...`);
            await ctx.runAction(api.ecwid.syncOrderToEcwid, { orderId });
            console.log(`Sync successful for ${orderId}!`);
        }
    }
});
