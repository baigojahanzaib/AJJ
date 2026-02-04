import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const run = mutation({
    args: {
        dryRun: v.optional(v.boolean()),
        limit: v.optional(v.number()), // Safety limit
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? true;
        const limit = args.limit ?? 1000;

        const orders = await ctx.db.query("orders").order("desc").take(limit);
        const results = [];
        let updatedCount = 0;

        for (const order of orders) {
            let orderUpdated = false;
            const newItems = [];

            for (const item of order.items) {
                let newItem = { ...item };

                // Fetch product
                const product = await ctx.db.get(item.productId as Id<"products">);

                if (!product) {
                    results.push({
                        orderNumber: order.orderNumber,
                        item: item.productName,
                        status: "skipped",
                        reason: "Product not found"
                    });
                    newItems.push(item);
                    continue;
                }

                // Logic to determine correct SKU
                let correctSku: string | undefined = undefined;
                let matchType: "combination" | "variation" | "none" = "none";

                // 1. Check Combinations (Priority)
                if (product.combinations && product.combinations.length > 0) {
                    // Convert selected variations to a map for easier comparison
                    // selectedVariations: [{ modification: "Size", option: "L" }, ...] 
                    // Wait, schema says: selectedVariations: v.array(selectedVariationValidator)
                    // selectedVariationValidator = { variationId, variationName, optionId, optionName, priceModifier }

                    // combination options: { name, value }

                    const selectedMap = new Map<string, string>();
                    for (const sv of item.selectedVariations) {
                        selectedMap.set(sv.variationName.trim().toLowerCase(), sv.optionName.trim().toLowerCase());
                    }

                    for (const combo of product.combinations) {
                        let match = true;
                        if (!combo.options || combo.options.length === 0) continue;

                        // A combination must match ALL its defined options against the selection
                        // (And usually the selection should cover all combination options)
                        for (const opt of combo.options) {
                            const selectedValue = selectedMap.get(opt.name.trim().toLowerCase());
                            if (selectedValue !== opt.value.trim().toLowerCase()) {
                                match = false;
                                break;
                            }
                        }

                        if (match) {
                            // Also ensure we don't have extra selected variations that aren't part of the combo?
                            // Usually not strictly required unless there are independent variations.
                            // Let's assume match is good enough.
                            if (combo.sku) {
                                correctSku = combo.sku;
                                matchType = "combination";
                            }
                            break;
                        }
                    }
                }

                // 2. Check Variations (Fallback or if no combinations)
                if (!correctSku && product.variations && product.variations.length > 0) {
                    // If multiple variations selected, finding "The" SKU is tricky unless one variation defines the SKU suffix
                    // or they are additive.
                    // Based on `debug_sku.ts`, we saw lookup by option.sku.
                    // If multiple options have SKUs, which one wins? 
                    // Usually the one that changes the SKU (e.g. Size). Color might not?
                    // Let's collect ALL SKUs from selected options that differ from Base SKU.

                    const potentialSkus: string[] = [];

                    for (const sv of item.selectedVariations) {
                        const variant = product.variations.find(v => v.id === sv.variationId || v.name === sv.variationName);
                        if (variant) {
                            const option = variant.options.find(o => o.id === sv.optionId || o.name === sv.optionName);
                            if (option && option.sku && option.sku !== product.sku) {
                                potentialSkus.push(option.sku);
                            }
                        }
                    }

                    if (potentialSkus.length === 1) {
                        correctSku = potentialSkus[0];
                        matchType = "variation";
                    } else if (potentialSkus.length > 1) {
                        // Ambiguous. 
                        // Check if any SKU contains the others? Or just pick first?
                        // User said "proper orders SKUs". 
                        // If we are unsure, we log.
                        results.push({
                            orderNumber: order.orderNumber,
                            item: item.productName,
                            status: "ambiguous",
                            reason: `Multiple variation SKUs found: ${potentialSkus.join(", ")}`
                        });
                    }
                }

                // Apply update if we found a distinct SKU and it differs from current
                if (correctSku && correctSku !== item.productSku) {
                    newItem.productSku = correctSku;
                    orderUpdated = true;
                    results.push({
                        orderNumber: order.orderNumber,
                        item: item.productName,
                        oldSku: item.productSku,
                        newSku: correctSku,
                        matchType,
                        status: dryRun ? "would_update" : "updated"
                    });
                } else if (correctSku && correctSku === item.productSku) {
                    // Already correct
                } else {
                    // No SKU found or ambiguous
                }

                newItems.push(newItem);
            }

            if (orderUpdated) {
                if (!dryRun) {
                    await ctx.db.patch(order._id, { items: newItems });
                }
                updatedCount++;
            }
        }

        return {
            updatedCount,
            results
        };
    }
});
