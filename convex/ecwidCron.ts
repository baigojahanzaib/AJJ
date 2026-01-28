import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Internal query to get settings for cron job
 */
export const getSettings = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("ecwidSettings").first();
    },
});

/**
 * Check if auto-sync should run and trigger it
 */
export const checkAndSync = internalAction({
    args: {},
    handler: async (ctx) => {
        // Get settings
        const settings = await ctx.runQuery(internal.ecwidCron.getSettings);

        if (!settings) {
            console.log("[Ecwid Cron] No settings configured, skipping");
            return;
        }

        if (!settings.autoSyncEnabled) {
            console.log("[Ecwid Cron] Auto-sync disabled, skipping");
            return;
        }

        if (!settings.storeId || !settings.accessToken) {
            console.log("[Ecwid Cron] Missing credentials, skipping");
            return;
        }

        // Check if enough time has passed since last sync
        const syncIntervalHours = settings.syncIntervalHours || 24;
        const lastSyncAt = settings.lastSyncAt ? new Date(settings.lastSyncAt) : null;

        if (lastSyncAt) {
            const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceSync < syncIntervalHours) {
                console.log(`[Ecwid Cron] Last sync was ${hoursSinceSync.toFixed(1)} hours ago, need ${syncIntervalHours} hours. Skipping.`);
                return;
            }
        }

        // Check if a sync is already in progress
        if (settings.lastSyncStatus === "in_progress") {
            // Check if "in_progress" is stale (older than 1 hour)
            const lastSyncAt = settings.lastSyncAt ? new Date(settings.lastSyncAt) : null;
            if (lastSyncAt && (Date.now() - lastSyncAt.getTime()) > 1000 * 60 * 60) {
                console.log("[Ecwid Cron] Found stale in_progress status (older than 1h), resetting...");
            } else {
                console.log("[Ecwid Cron] Sync already in progress, skipping");
                return;
            }
        }

        console.log("[Ecwid Cron] Starting auto-sync...");
        const syncStartTime = new Date().toISOString();

        try {
            // Import and call the fullSync action
            // We need to manually implement the sync here since we can't call external actions from internal actions
            const ECWID_API_BASE = "https://app.ecwid.com/api/v3";

            // Update status to in_progress
            await ctx.runMutation(internal.ecwid.updateSyncStatus, {
                status: "in_progress",
                message: "Auto-sync starting...",
            });

            // Determine incremental sync parameter
            let updatedFromParam = "";
            let isIncremental = false;

            // Only use incremental sync if we have a successful previous sync
            if (settings.lastSuccessfulSyncAt) {
                const lastSuccess = new Date(settings.lastSuccessfulSyncAt);
                if (!isNaN(lastSuccess.getTime())) {
                    // Buffer: Go back 5 minutes to ensure no overlap overlap issues
                    // Ecwid expects UNIX timestamp
                    const unixTime = Math.floor((lastSuccess.getTime() - 5 * 60 * 1000) / 1000);
                    updatedFromParam = `&updatedFrom=${unixTime}`;
                    isIncremental = true;
                    console.log(`[Ecwid Cron] Performing incremental sync since ${settings.lastSuccessfulSyncAt}`);
                }
            }

            // Sync categories
            let categoryCount = 0;
            let offset = 0;
            const limit = 100;

            while (true) {
                const catUrl = `${ECWID_API_BASE}/${settings.storeId}/categories?offset=${offset}&limit=${limit}${updatedFromParam}`;
                const catResponse = await fetch(catUrl, {
                    headers: {
                        "Authorization": `Bearer ${settings.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!catResponse.ok) {
                    throw new Error(`Ecwid API error (categories): ${catResponse.status}`);
                }

                const catData = await catResponse.json();

                for (const cat of catData.items) {
                    await ctx.runMutation(internal.ecwid.upsertCategory, {
                        ecwidId: cat.id,
                        name: cat.name || "Unnamed Category",
                        description: cat.description || "",
                        image: cat.imageUrl,
                        parentEcwidId: cat.parentId,
                        isActive: cat.enabled !== false,
                    });
                    categoryCount++;
                }

                // If incremental, we might get fewer results than limit, so we just check count
                if (offset + catData.count >= catData.total) break;
                offset += limit;
            }

            // Sync products
            let productCount = 0;
            offset = 0;

            while (true) {
                const prodUrl = `${ECWID_API_BASE}/${settings.storeId}/products?offset=${offset}&limit=${limit}${updatedFromParam}`;
                const prodResponse = await fetch(prodUrl, {
                    headers: {
                        "Authorization": `Bearer ${settings.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!prodResponse.ok) {
                    throw new Error(`Ecwid API error (products): ${prodResponse.status}`);
                }

                const prodData = await prodResponse.json();

                for (const prod of prodData.items) {
                    const images: string[] = [];
                    if (prod.imageUrl) images.push(prod.imageUrl);
                    if (prod.galleryImages) {
                        images.push(...prod.galleryImages.map((img: any) => img.url));
                    }
                    if (images.length === 0) {
                        images.push("https://via.placeholder.com/300");
                    }

                    const variations: any[] = [];
                    if (prod.options && prod.options.length > 0) {
                        for (const option of prod.options) {
                            const convexVariation = {
                                id: `opt-${option.name.toLowerCase().replace(/\s+/g, '-')}`,
                                name: option.name,
                                options: (option.choices || []).map((choice: any, index: number) => {
                                    let priceModifier = choice.priceModifier || 0;
                                    if (choice.priceModifierType === "PERCENT") {
                                        priceModifier = (prod.price * priceModifier) / 100;
                                    }
                                    return {
                                        id: `${option.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
                                        name: choice.text,
                                        priceModifier,
                                        sku: prod.sku ? `${prod.sku}-${choice.text}` : `SKU-${index}`,
                                        stock: prod.quantity || 0,
                                        image: undefined,
                                    };
                                }),
                            };
                            variations.push(convexVariation);
                        }
                    }

                    const description = (prod.description || "").replace(/<[^>]*>/g, '').trim();

                    await ctx.runMutation(internal.ecwid.upsertProduct, {
                        ecwidId: prod.id,
                        name: prod.name || "Unnamed Product",
                        description,
                        sku: prod.sku || `ECWID-${prod.id}`,
                        basePrice: prod.price || 0,
                        images,
                        categoryEcwidId: prod.categoryIds?.[0],
                        isActive: prod.enabled !== false,
                        variations,
                        combinations: prod.combinations?.map((c: any) => ({
                            id: c.id,
                            options: c.options?.map((o: any) => ({
                                name: o.name,
                                value: o.value
                            })) || [],
                            price: c.price,
                            sku: c.sku,
                            stock: c.quantity
                        })),
                        stock: prod.quantity || 0,
                        ribbon: prod.ribbon?.text,
                        ribbonColor: prod.ribbon?.color,
                    });
                    productCount++;
                }

                if (offset + prodData.count >= prodData.total) break;
                offset += limit;
            }

            await ctx.runMutation(internal.ecwid.updateSyncStatus, {
                status: "success",
                message: `Auto-sync: ${categoryCount} categories, ${productCount} products`,
                productCount,
                categoryCount,
                successfulSyncTime: syncStartTime,
            });

            console.log(`[Ecwid Cron] Auto-sync complete: ${categoryCount} categories, ${productCount} products`);

        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error("[Ecwid Cron] Auto-sync failed:", message);

            await ctx.runMutation(internal.ecwid.updateSyncStatus, {
                status: "error",
                message: `Auto-sync failed: ${message}`,
            });
        }
    },
});
