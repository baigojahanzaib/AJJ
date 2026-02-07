import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const toEcwidSelectedOptions = (selectedVariations: any[]): any[] => {
    if (!Array.isArray(selectedVariations) || selectedVariations.length === 0) {
        return [];
    }

    return selectedVariations
        .map((selected: any) => {
            const name = selected?.variationName?.trim();
            const value = selected?.optionName?.trim();
            if (!name || !value) {
                return null;
            }

            const mapped: any = {
                name,
                type: "CHOICE",
                value,
            };

            if (typeof selected?.priceModifier === "number" && Number.isFinite(selected.priceModifier)) {
                mapped.selections = [{
                    selectionTitle: value,
                    selectionModifier: selected.priceModifier,
                    selectionModifierType: "ABSOLUTE",
                }];
            }

            return mapped;
        })
        .filter(Boolean);
};

export const run = action({
    args: {
        dryRun: v.optional(v.boolean()),
        limit: v.optional(v.number()),
        orderId: v.optional(v.string()) // Optional: target specific order
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? true;
        const limit = args.limit ?? 50;

        // 1. Get Ecwid Settings
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) {
            throw new Error("Ecwid not configured");
        }

        // 2. Fetch Orders (We need the FULL order objects to get items and IDs)
        // We'll use a simple query to get recent orders. 
        // Ideally we would filter for "modified" ones, but we didn't track "needs_sync".
        // We'll just scan recent ones or specific ones.
        // For this task, we want to sync the ones we just fixed? 
        // We didn't save a list. 
        // Strategy: Sync ALL recent orders that have an ecwidOrderId. 
        // This is safe because we are just pushing the "Correct" state from Convex.

        // Define an internal query to fetch orders to avoid writing it inline if complex,
        // but for now we can just reuse `convex/orders.ts:list` or direct query if we had access (actions don't have direct DB access).
        // We must use runQuery. `internal.orders.list` might not expose enough or be internal.
        // `convex/orders.ts` exports `list`. Let's use `internal.orders.list`? 
        // Wait, `convex/orders.ts` `list` is a public query.

        // To be efficient and safe, I'll create an internal query helper inside this file or assume I can use `internal.ecwid.listPendingOrders` but that filters by "not synced".
        // I'll assume I can just use a new internal query or one-off.
        // Actually, I can't define an internal query in this file and call it immediately in the same deployment without deploying first.
        // And I can't put it in `_generated`.
        // I will use `internal.ecwid.getOrderDetails` in a loop if I have IDs? 
        // Or I can use `api.orders.list` (public query) via `ctx.runQuery`? No, `runQuery` expects `FunctionReference`. 
        // `api.orders.list` works.

        // Better: I'll define the internal query in THIS file, and export it.
        // But since this is a new file, I'll need to deploy it first anyway.
        // So I'll structure it correctly.

        const orders = await ctx.runQuery((internal as any).sync_queries.listRecentSyncedOrders, { limit });

        console.log(`Found ${orders.length} recent orders to identify for sync.`);

        const results = [];
        let syncedCount = 0;

        for (const order of orders) {
            if (args.orderId && order._id !== args.orderId && order.orderNumber !== args.orderId) continue;

            // Construct updated items payload
            const ecwidItems = order.items.map((item: any) => {
                const mapped: any = {
                    name: item.productName,
                    price: item.unitPrice,
                    quantity: item.quantity,
                    sku: item.productSku,
                    // We don't necessarily need productId for the UPDATE to work if SKU/Name is there?
                    // Ecwid usually matches by ID if provided, or creates new? 
                    // If we strictly want to UPDATE the existing order items, we usually just provide the array.
                    // Ecwid Replace Strategy: "If you want to update the products in the order, you should pass the whole list of products in the 'items' field."
                    // We should try to preserve existing Ecwid Item IDs if possible? 
                    // We don't store Ecwid Item IDs in `order.items`.
                    // So we are forcing a rewrite of items. This might re-generate IDs on Ecwid side.
                    // This is acceptable for "Fixing SKUs".
                };

                const selectedOptions = toEcwidSelectedOptions(item.selectedVariations);
                if (selectedOptions.length > 0) {
                    mapped.selectedOptions = selectedOptions;
                }

                return mapped;
            });

            if (dryRun) {
                results.push({
                    orderNumber: order.orderNumber,
                    ecwidOrderId: order.ecwidOrderId,
                    action: "update_items",
                    payload: ecwidItems
                });
            } else {
                try {
                    const url = `https://app.ecwid.com/api/v3/${settings.storeId}/orders/${order.ecwidOrderId}`;
                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            "Authorization": `Bearer ${settings.accessToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ items: ecwidItems }),
                    });

                    if (!response.ok) {
                        const err = await response.text();
                        results.push({ order: order.orderNumber, success: false, error: err });
                        console.error(`Failed to sync ${order.orderNumber}: ${err}`);
                    } else {
                        const json = await response.json();
                        results.push({ order: order.orderNumber, success: true, ecwidId: json.id });
                        syncedCount++;
                        console.log(`Synced ${order.orderNumber}`);
                    }
                } catch (e: any) {
                    results.push({ order: order.orderNumber, success: false, error: e.message });
                }
            }
        }

        return {
            mode: dryRun ? "DRY RUN" : "LIVE",
            count: orders.length,
            syncedCount,
            results
        };
    }
}) as any;



