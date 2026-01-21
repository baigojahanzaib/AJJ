import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Settings Queries and Mutations
// ============================================================================

/**
 * Get Ecwid settings (singleton record)
 */
export const getSettings = query({
    args: {},
    handler: async (ctx) => {
        const settings = await ctx.db.query("ecwidSettings").first();
        if (!settings) {
            return null;
        }
        // Don't expose access token to client
        return {
            ...settings,
            accessToken: settings.accessToken ? "••••••••" : "",
            hasAccessToken: !!settings.accessToken,
        };
    },
});

/**
 * Save Ecwid settings
 */
export const saveSettings = mutation({
    args: {
        storeId: v.string(),
        accessToken: v.optional(v.string()),
        autoSyncEnabled: v.boolean(),
        syncIntervalHours: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("ecwidSettings").first();

        if (existing) {
            const updates: Record<string, unknown> = {
                storeId: args.storeId,
                autoSyncEnabled: args.autoSyncEnabled,
                syncIntervalHours: args.syncIntervalHours ?? 24,
            };
            // Only update token if provided
            if (args.accessToken) {
                updates.accessToken = args.accessToken;
            }
            await ctx.db.patch(existing._id, updates);
            return existing._id;
        } else {
            return await ctx.db.insert("ecwidSettings", {
                storeId: args.storeId,
                accessToken: args.accessToken ?? "",
                autoSyncEnabled: args.autoSyncEnabled,
                syncIntervalHours: args.syncIntervalHours ?? 24,
            });
        }
    },
});

// ============================================================================
// Sync Status
// ============================================================================

/**
 * Get sync status
 */
export const getSyncStatus = query({
    args: {},
    handler: async (ctx) => {
        const settings = await ctx.db.query("ecwidSettings").first();
        if (!settings) {
            return {
                configured: false,
                lastSyncAt: null,
                lastSyncStatus: null,
                lastSyncMessage: null,
                lastSyncProductCount: null,
                lastSyncCategoryCount: null,
            };
        }
        return {
            configured: !!(settings.storeId && settings.accessToken),
            lastSyncAt: settings.lastSyncAt ?? null,
            lastSyncStatus: settings.lastSyncStatus ?? null,
            lastSyncMessage: settings.lastSyncMessage ?? null,
            lastSyncProductCount: settings.lastSyncProductCount ?? null,
            lastSyncCategoryCount: settings.lastSyncCategoryCount ?? null,
        };
    },
});

// ============================================================================
// Internal mutations for sync operations
// ============================================================================

/**
 * Update sync status (internal)
 */
export const updateSyncStatus = internalMutation({
    args: {
        status: v.union(v.literal("success"), v.literal("error"), v.literal("in_progress")),
        message: v.optional(v.string()),
        productCount: v.optional(v.number()),
        categoryCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const settings = await ctx.db.query("ecwidSettings").first();
        if (!settings) return;

        await ctx.db.patch(settings._id, {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: args.status,
            lastSyncMessage: args.message,
            lastSyncProductCount: args.productCount,
            lastSyncCategoryCount: args.categoryCount,
        });
    },
});

/**
 * Upsert a category from Ecwid (internal)
 */
export const upsertCategory = internalMutation({
    args: {
        ecwidId: v.number(),
        name: v.string(),
        description: v.string(),
        image: v.optional(v.string()),
        parentEcwidId: v.optional(v.number()),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        // Check if category exists by ecwidId
        const existing = await ctx.db
            .query("categories")
            .withIndex("by_ecwidId", (q) => q.eq("ecwidId", args.ecwidId))
            .first();

        // Resolve parent category ID if provided
        let parentId: string | undefined;
        if (args.parentEcwidId) {
            const parentCategory = await ctx.db
                .query("categories")
                .withIndex("by_ecwidId", (q) => q.eq("ecwidId", args.parentEcwidId))
                .first();
            parentId = parentCategory?._id;
        }

        if (existing) {
            await ctx.db.patch(existing._id, {
                name: args.name,
                description: args.description,
                image: args.image,
                parentId,
                isActive: args.isActive,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("categories", {
                name: args.name,
                description: args.description,
                image: args.image,
                parentId,
                isActive: args.isActive,
                createdAt: new Date().toISOString(),
                ecwidId: args.ecwidId,
            });
        }
    },
});

/**
 * Upsert a product from Ecwid (internal)
 */
export const upsertProduct = internalMutation({
    args: {
        ecwidId: v.number(),
        name: v.string(),
        description: v.string(),
        sku: v.string(),
        basePrice: v.number(),
        compareAtPrice: v.optional(v.number()),
        images: v.array(v.string()),
        categoryEcwidId: v.optional(v.number()),
        isActive: v.boolean(),
        variations: v.array(v.object({
            id: v.string(),
            name: v.string(),
            options: v.array(v.object({
                id: v.string(),
                name: v.string(),
                priceModifier: v.number(),
                sku: v.string(),
                stock: v.number(),
                image: v.optional(v.string()),
            })),
        })),
        stock: v.number(),
        ribbon: v.optional(v.string()),
        ribbonColor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if product exists by ecwidId
        const existing = await ctx.db
            .query("products")
            .withIndex("by_ecwidId", (q) => q.eq("ecwidId", args.ecwidId))
            .first();

        // Resolve category ID
        let categoryId = "";
        if (args.categoryEcwidId) {
            const category = await ctx.db
                .query("categories")
                .withIndex("by_ecwidId", (q) => q.eq("ecwidId", args.categoryEcwidId))
                .first();
            categoryId = category?._id ?? "";
        }

        // If no category found, use first available or create "Uncategorized"
        if (!categoryId) {
            const anyCategory = await ctx.db.query("categories").first();
            if (anyCategory) {
                categoryId = anyCategory._id;
            } else {
                categoryId = await ctx.db.insert("categories", {
                    name: "Uncategorized",
                    description: "Products without a category",
                    isActive: true,
                    createdAt: new Date().toISOString(),
                });
            }
        }

        if (existing) {
            await ctx.db.patch(existing._id, {
                name: args.name,
                description: args.description,
                sku: args.sku,
                basePrice: args.basePrice,
                compareAtPrice: args.compareAtPrice,
                images: args.images,
                categoryId,
                isActive: args.isActive,
                variations: args.variations,
                stock: args.stock,
                ribbon: args.ribbon,
                ribbonColor: args.ribbonColor,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("products", {
                name: args.name,
                description: args.description,
                sku: args.sku,
                basePrice: args.basePrice,
                compareAtPrice: args.compareAtPrice,
                images: args.images,
                categoryId,
                isActive: args.isActive,
                variations: args.variations,
                stock: args.stock,
                ribbon: args.ribbon,
                ribbonColor: args.ribbonColor,
                createdAt: new Date().toISOString(),
                ecwidId: args.ecwidId,
            });
        }
    },
});

// ============================================================================
// Sync Action
// ============================================================================

/**
 * Full sync from Ecwid - fetches categories and products
 */
export const fullSync = action({
    args: {},
    handler: async (ctx) => {
        // Get settings
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) {
            throw new Error("Ecwid is not configured. Please add Store ID and Access Token.");
        }

        // Update status to in_progress
        await ctx.runMutation(internal.ecwid.updateSyncStatus, {
            status: "in_progress",
            message: "Starting sync...",
        });

        try {
            const ECWID_API_BASE = "https://app.ecwid.com/api/v3";

            // =========================================
            // Fetch and sync categories
            // =========================================
            let categoryCount = 0;
            let offset = 0;
            const limit = 100;

            while (true) {
                const catUrl = `${ECWID_API_BASE}/${settings.storeId}/categories?offset=${offset}&limit=${limit}`;
                const catResponse = await fetch(catUrl, {
                    headers: {
                        "Authorization": `Bearer ${settings.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!catResponse.ok) {
                    const errorText = await catResponse.text();
                    throw new Error(`Ecwid API error (categories): ${catResponse.status} - ${errorText}`);
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

                if (offset + catData.count >= catData.total) break;
                offset += limit;
            }

            // =========================================
            // Fetch and sync products
            // =========================================
            let productCount = 0;
            offset = 0;

            while (true) {
                const prodUrl = `${ECWID_API_BASE}/${settings.storeId}/products?offset=${offset}&limit=${limit}`;
                const prodResponse = await fetch(prodUrl, {
                    headers: {
                        "Authorization": `Bearer ${settings.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!prodResponse.ok) {
                    const errorText = await prodResponse.text();
                    throw new Error(`Ecwid API error (products): ${prodResponse.status} - ${errorText}`);
                }

                const prodData = await prodResponse.json();

                for (const prod of prodData.items) {
                    // Build images array
                    const images: string[] = [];
                    if (prod.imageUrl) images.push(prod.imageUrl);
                    if (prod.galleryImages) {
                        images.push(...prod.galleryImages.map((img: any) => img.url));
                    }
                    if (images.length === 0) {
                        images.push("https://via.placeholder.com/300");
                    }

                    // Build variations from options
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

                    // Strip HTML from description
                    const description = (prod.description || "").replace(/<[^>]*>/g, '').trim();

                    await ctx.runMutation(internal.ecwid.upsertProduct, {
                        ecwidId: prod.id,
                        name: prod.name || "Unnamed Product",
                        description,
                        sku: prod.sku || `ECWID-${prod.id}`,
                        basePrice: prod.price || 0,
                        compareAtPrice: prod.compareToPrice,
                        images,
                        categoryEcwidId: prod.categoryIds?.[0],
                        isActive: prod.enabled !== false,
                        variations,
                        stock: prod.quantity || 0,
                        ribbon: prod.ribbon?.text,
                        ribbonColor: prod.ribbon?.color,
                    });
                    productCount++;
                }

                if (offset + prodData.count >= prodData.total) break;
                offset += limit;
            }

            // Update status to success
            await ctx.runMutation(internal.ecwid.updateSyncStatus, {
                status: "success",
                message: `Successfully synced ${categoryCount} categories and ${productCount} products`,
                productCount,
                categoryCount,
            });

            return { success: true, categoryCount, productCount };

        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await ctx.runMutation(internal.ecwid.updateSyncStatus, {
                status: "error",
                message,
            });
            throw error;
        }
    },
});

/**
 * Internal query to get full settings with access token
 */
export const getSettingsInternal = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("ecwidSettings").first();
    },
});

/**
 * Test Ecwid connection
 */
export const testConnection = action({
    args: {
        storeId: v.string(),
        accessToken: v.string(),
    },
    handler: async (_, args) => {
        try {
            const url = `https://app.ecwid.com/api/v3/${args.storeId}/profile`;
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${args.accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                return {
                    success: false,
                    message: `Connection failed: ${response.status} - ${response.statusText}`,
                };
            }

            const profile = await response.json();
            return {
                success: true,
                message: `Connected to store: ${profile.generalInfo?.storeUrl || args.storeId}`,
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    },
});

/**
 * Sync an order to Ecwid
 */
export const syncOrderToEcwid = action({
    args: {
        orderId: v.id("orders"),
    },
    handler: async (ctx, args) => {
        // Get settings
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) {
            console.error("Ecwid sync failed: Not configured");
            return;
        }

        // Get order details
        const order = await ctx.runQuery(internal.ecwid.getOrderDetails, { orderId: args.orderId });
        if (!order) {
            console.error("Ecwid sync failed: Order not found");
            return;
        }

        if (order.ecwidOrderId) {
            console.log("Order already synced to Ecwid:", order.ecwidOrderId);
            return;
        }

        // Map order items to Ecwid format
        const ecwidItems = order.items.map((item) => ({
            name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
            sku: item.productSku,
        }));

        // Construct Ecwid Order object
        let paymentStatus: "PAID" | "AWAITING_PAYMENT" = "AWAITING_PAYMENT";
        let fulfillmentStatus: "AWAITING_PROCESSING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELED" = "AWAITING_PROCESSING";

        if (["confirmed", "processing", "shipped", "delivered"].includes(order.status)) {
            paymentStatus = "PAID";
        }

        switch (order.status) {
            case "processing":
                fulfillmentStatus = "PROCESSING";
                break;
            case "shipped":
                fulfillmentStatus = "SHIPPED";
                break;
            case "delivered":
                fulfillmentStatus = "DELIVERED";
                break;
            case "cancelled":
                fulfillmentStatus = "CANCELED";
                break;
            default:
                fulfillmentStatus = "AWAITING_PROCESSING";
        }

        const ecwidOrder: any = {
            subtotal: order.subtotal,
            total: order.total,
            email: order.customerEmail,
            paymentStatus,
            fulfillmentStatus,
            items: ecwidItems,
            billingPerson: {
                name: order.customerName,
                phone: order.customerPhone,
                street: order.customerAddress,
            },
            shippingPerson: {
                name: order.customerName,
                phone: order.customerPhone,
                street: order.customerAddress,
            },
            externalId: order._id,
            privateAdminNotes: `Synced from AJJ Platform. Order #${order.orderNumber}. Sales Rep: ${order.salesRepName}`,
        };

        try {
            const ECWID_API_BASE = "https://app.ecwid.com/api/v3";
            const url = `${ECWID_API_BASE}/${settings.storeId}/orders`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${settings.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(ecwidOrder),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Ecwid API error: ${response.status} - ${text}`);
            }

            const result = await response.json();

            // Update order with Ecwid ID
            await ctx.runMutation(internal.ecwid.updateOrderEcwidId, {
                orderId: args.orderId,
                ecwidOrderId: result.id
            });

            console.log(`Successfully synced order ${order.orderNumber} to Ecwid. Ecwid ID: ${result.id}`);

        } catch (error) {
            console.error("Failed to sync order to Ecwid:", error);
        }
    }
});

/**
 * Internal query to get order details
 */
export const getOrderDetails = internalQuery({
    args: { orderId: v.id("orders") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.orderId);
    },
});

/**
 * Internal mutation to update order with Ecwid ID
 */
export const updateOrderEcwidId = internalMutation({
    args: {
        orderId: v.id("orders"),
        ecwidOrderId: v.union(v.string(), v.number())
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.orderId, {
            ecwidOrderId: args.ecwidOrderId
        });
    },
});

/**
 * Backfill existing orders to Ecwid (Manual Trigger)
 */
export const backfillOrders = internalMutation({
    args: {},
    handler: async (ctx) => {
        const orders = await ctx.db.query("orders").collect();
        let count = 0;
        for (const order of orders) {
            if (!order.ecwidOrderId) {
                await ctx.scheduler.runAfter(0, api.ecwid.syncOrderToEcwid, {
                    orderId: order._id
                });
                count++;
            }
        }
        console.log(`Scheduled backfill sync for ${count} orders`);
        return count;
    },
});
