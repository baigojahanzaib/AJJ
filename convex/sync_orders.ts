import { internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const scheduleSyncForLocalOrders = internalMutation({
    args: {},
    handler: async (ctx) => {
        const orders = await ctx.db.query("orders").collect();
        let count = 0;

        for (const order of orders) {
            // Only sync if it doesn't have an Ecwid ID
            if (!order.ecwidOrderId) {
                // Schedule the sync action
                await ctx.scheduler.runAfter(0, api.ecwid.syncOrderToEcwid, {
                    orderId: order._id,
                });
                count++;
            }
        }
        console.log(`Scheduled sync for ${count} local orders.`);
        return count;
    },
});

export const checkSyncStatus = internalMutation({
    args: {},
    handler: async (ctx) => {
        const orders = await ctx.db.query("orders").collect();
        const synced = orders.filter(o => !!o.ecwidOrderId).length;
        const pending = orders.filter(o => !o.ecwidOrderId);

        if (pending.length > 0) {
            console.log("Pending Orders Details:");
            for (const p of pending) {
                console.log(JSON.stringify({
                    id: p._id,
                    orderNumber: p.orderNumber,
                    email: p.customerEmail,
                    itemsCount: p.items.length,
                    items: p.items.map(i => ({ name: i.productName, sku: i.productSku, id: i.productId })),
                    address: p.customerAddress
                }, null, 2));
            }
        }

        return {
            total: orders.length,
            synced,
            pendingCount: pending.length,
            pendingIds: pending.map(o => o._id)
        };
    }
});

export const updateOrderEmail = internalMutation({
    args: { orderId: v.id("orders"), email: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orderId, { customerEmail: args.email });
    }
});

export const fixAndSync = internalAction({
    args: {},
    handler: async (ctx) => {
        const orders: any[] = await ctx.runMutation(internal.sync_orders.getPendingOrders);

        for (const order of orders) {
            let email = order.customerEmail;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email || !emailRegex.test(email)) {
                // Fix: replace "sohaz" with "sohaz@example.com" or generic
                const base = email ? email.replace(/\s+/g, '') : "customer";
                const newEmail = base.includes('@') ? base : `${base}@example.com`;

                console.log(`Fixing email for ${order._id}: "${email}" -> "${newEmail}"`);

                // Update the order in Convex
                await ctx.runMutation(internal.sync_orders.updateOrderEmail, {
                    orderId: order._id,
                    email: newEmail
                });
            }

            console.log(`Retrying sync for ${order._id}...`);
            await ctx.runAction(api.ecwid.syncOrderToEcwid, { orderId: order._id });
            console.log(`Sync successful for ${order._id}!`);
        }
    }
});

export const getPendingOrders = internalMutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("orders").filter(q => q.eq(q.field("ecwidOrderId"), undefined)).collect();
    }
});
