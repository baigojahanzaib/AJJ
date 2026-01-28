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
        successfulSyncTime: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const settings = await ctx.db.query("ecwidSettings").first();
        if (!settings) return;

        const updates: any = {
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: args.status,
            lastSyncMessage: args.message,
            lastSyncProductCount: args.productCount,
            lastSyncCategoryCount: args.categoryCount,
        };

        if (args.successfulSyncTime) {
            updates.lastSuccessfulSyncAt = args.successfulSyncTime;
        }

        await ctx.db.patch(settings._id, updates);
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
            // Check for changes
            if (
                existing.name === args.name &&
                existing.description === args.description &&
                existing.image === args.image &&
                existing.parentId === parentId &&
                existing.isActive === args.isActive
            ) {
                // No changes, skip write
                return existing._id;
            }

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
 * Upsert a customer from Ecwid (internal)
 */
export const upsertCustomer = internalMutation({
    args: {
        ecwidId: v.number(),
        email: v.string(),
        name: v.string(),
        phone: v.string(),
        address: v.string(),
        city: v.optional(v.string()),
        countryCode: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        company: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if customer exists by email (primary key for customers table)
        const existing = await ctx.db
            .query("customers")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .first();

        // Format address
        let fullAddress = args.address;
        if (args.city) fullAddress += `, ${args.city}`;
        if (args.countryCode) fullAddress += `, ${args.countryCode}`;
        if (args.postalCode) fullAddress += ` ${args.postalCode}`;
        fullAddress = fullAddress.replace(/^, /, "").trim();

        if (existing) {
            // Check for changes
            if (
                existing.name === args.name &&
                existing.phone === args.phone &&
                existing.address === fullAddress &&
                existing.company === args.company &&
                existing.ecwidId === args.ecwidId
            ) {
                return existing._id;
            }

            await ctx.db.patch(existing._id, {
                name: args.name,
                phone: args.phone,
                address: fullAddress,
                company: args.company,
                ecwidId: args.ecwidId,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("customers", {
                name: args.name,
                phone: args.phone,
                email: args.email,
                address: fullAddress,
                company: args.company,
                isActive: true, // Default to active for synced customers
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
        combinations: v.optional(v.array(v.object({
            id: v.union(v.string(), v.number()),
            options: v.array(v.object({
                name: v.string(),
                value: v.string(),
            })),
            price: v.number(),
            sku: v.optional(v.string()),
            stock: v.optional(v.number()),
        }))),
        stock: v.number(),
        ribbon: v.optional(v.string()),
        ribbonColor: v.optional(v.string()),
        moq: v.optional(v.number()),
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
            // Check for changes
            if (
                existing.name === args.name &&
                existing.description === args.description &&
                existing.sku === args.sku &&
                existing.basePrice === args.basePrice &&
                existing.compareAtPrice === args.compareAtPrice &&
                JSON.stringify(existing.images) === JSON.stringify(args.images) &&
                existing.categoryId === categoryId &&
                existing.isActive === args.isActive &&
                JSON.stringify(existing.variations) === JSON.stringify(args.variations) &&
                existing.stock === args.stock &&
                existing.ribbon === args.ribbon &&
                existing.ribbonColor === args.ribbonColor &&
                existing.moq === args.moq
            ) {
                // No changes, skip write
                return existing._id;
            }

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
                combinations: args.combinations,
                stock: args.stock,
                ribbon: args.ribbon,
                ribbonColor: args.ribbonColor,
                moq: args.moq,
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
                combinations: args.combinations,
                stock: args.stock,
                ribbon: args.ribbon,
                ribbonColor: args.ribbonColor,
                moq: args.moq,
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
 * Full sync from Ecwid - fetches categories, products, and customers
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

        const lastSyncTime = settings.lastSuccessfulSyncAt ? new Date(settings.lastSuccessfulSyncAt).getTime() / 1000 : 0;
        const updatedFromParam = lastSyncTime > 0 ? `&updatedFrom=${Math.floor(lastSyncTime)}` : "";

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
                const prodUrl = `${ECWID_API_BASE}/${settings.storeId}/products?offset=${offset}&limit=${limit}${updatedFromParam}`;
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

                    // Extract MOQ from attributes
                    let moq = undefined;
                    if (prod.attributes && Array.isArray(prod.attributes)) {
                        const moqAttr = prod.attributes.find((attr: any) =>
                            attr.name && attr.name.toLowerCase() === 'moq'
                        );
                        if (moqAttr && moqAttr.value) {
                            const parsedMoq = parseFloat(moqAttr.value);
                            if (!isNaN(parsedMoq) && parsedMoq > 0) {
                                moq = parsedMoq;
                            }
                        }
                    }

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
                        moq,
                    });
                    productCount++;
                }

                if (offset + prodData.count >= prodData.total) break;
                offset += limit;
            }

            // =========================================
            // Fetch and sync customers
            // =========================================
            let customerCount = 0;
            offset = 0;

            while (true) {
                const custUrl = `${ECWID_API_BASE}/${settings.storeId}/customers?offset=${offset}&limit=${limit}${updatedFromParam}`;
                const custResponse = await fetch(custUrl, {
                    headers: {
                        "Authorization": `Bearer ${settings.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!custResponse.ok) {
                    const errorText = await custResponse.text();
                    console.error(`Ecwid API error (customers): ${custResponse.status} - ${errorText}`);
                    // Don't fail the whole sync if customers fail
                    break;
                }

                const custData = await custResponse.json();

                for (const cust of custData.items) {
                    if (!cust.email) {
                        continue;
                    }

                    await ctx.runMutation(internal.ecwid.upsertCustomer, {
                        ecwidId: cust.id,
                        email: cust.email,
                        name: cust.name || cust.billingPerson?.name || "Unknown Name",
                        phone: cust.billingPerson?.phone || "",
                        address: cust.billingPerson?.street || "",
                        city: cust.billingPerson?.city,
                        countryCode: cust.billingPerson?.countryCode,
                        postalCode: cust.billingPerson?.postalCode,
                        company: cust.billingPerson?.company,
                    });
                    customerCount++;
                }

                if (offset + custData.count >= custData.total) break;
                offset += limit;
            }

            // Update status to success
            await ctx.runMutation(internal.ecwid.updateSyncStatus, {
                status: "success",
                message: `Successfully synced ${categoryCount} categories, ${productCount} products, and ${customerCount} customers`,
                productCount,
                categoryCount,
                successfulSyncTime: new Date().toISOString(),
            });

            return { success: true, categoryCount, productCount, customerCount };

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
// Refactored handler to be reusable
const syncOrderToEcwidHandler = async (ctx: any, args: { orderId: any }) => {
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
    const ecwidItems = await Promise.all(order.items.map(async (item: any) => {
        // Try to find the product to get its Ecwid ID
        let productId: number | undefined;
        let sku = item.productSku;

        if (item.productId) {
            const product = await ctx.runQuery(internal.ecwid.getProductInternal, {
                productId: item.productId
            });
            if (product && product.ecwidId) {
                productId = product.ecwidId;
                // Prefer product SKU if available to ensure match
                if (product.sku) sku = product.sku;
            }
        }

        return {
            name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
            sku: sku,
            productId: productId,
        };
    }));

    // Construct Ecwid Order object
    let paymentStatus = "AWAITING_PAYMENT";
    let fulfillmentStatus = "AWAITING_PROCESSING";

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

    // Ecwid requires certain address fields. We'll attempt to parse them or use defaults.
    // Assuming simple address format or defaults since we only capture a single string.
    const defaultCity = "Johannesburg"; // Fallback
    const defaultCountry = "ZA";       // South Africa fallback
    const defaultZip = "0000";

    const ecwidOrder: any = {
        subtotal: order.subtotal,
        total: order.total,
        email: order.customerEmail || "no-email@example.com", // Ecwid often requires email
        paymentStatus,
        fulfillmentStatus,
        items: ecwidItems,
        billingPerson: {
            name: order.customerName,
            phone: order.customerPhone,
            street: order.customerAddress || "No Address Provided",
            city: defaultCity,
            countryCode: defaultCountry,
            postalCode: defaultZip,
        },
        shippingPerson: {
            name: order.customerName,
            phone: order.customerPhone,
            street: order.customerAddress || "No Address Provided",
            city: defaultCity,
            countryCode: defaultCountry,
            postalCode: defaultZip,
        },
        externalId: order._id,
        privateAdminNotes: `Synced from AJJ Platform. Order #${order.orderNumber}. Sales Rep: ${order.salesRepName}`,
    };

    console.log("Syncing order to Ecwid payload:", JSON.stringify(ecwidOrder));

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
            console.error(`Ecwid API Error Response: ${text}`);
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
        throw error; // Re-throw to let the caller know it failed
    }
};

export const syncOrderToEcwid = action({
    args: {
        orderId: v.id("orders"),
    },
    handler: syncOrderToEcwidHandler
});

/**
 * Manually sync all pending orders to Ecwid
 */
/**
 * Internal query to list pending orders for sync
 */
export const listPendingOrders = internalQuery({
    args: {},
    handler: async (ctx) => {
        // We can't filter by missing field easily in standard query without index, 
        // but for manual sync, fetching all and filtering in memory is acceptable for reasonable dataset.
        // Or we can use .filter() if available in Convex query builder (it is).
        const orders = await ctx.db.query("orders").collect();
        return orders.filter((o: any) => !o.ecwidOrderId && o.status !== 'cancelled');
    }
});

/**
 * Manually sync all pending orders to Ecwid
 */
export const syncPendingOrders = action({
    args: {},
    handler: async (ctx) => {
        const pending: any[] = await ctx.runQuery(internal.ecwid.listPendingOrders);
        console.log(`Found ${pending.length} pending orders to sync.`);

        let synced = 0;
        for (const order of pending) {
            console.log(`Syncing order ${order.orderNumber} (${order._id})...`);
            try {
                await syncOrderToEcwidHandler(ctx, { orderId: order._id });
                synced++;
            } catch (e) {
                console.error(`Failed to sync ${order.orderNumber}:`, e);
            }
        }
        return `Attempted to sync ${pending.length} orders. Successfully synced: ${synced}.`;
    }
});

/**
 * Sync order status to Ecwid
 */
export const syncOrderStatusToEcwid = action({
    args: {
        orderId: v.id("orders"),
        status: v.string(),
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

        if (!order.ecwidOrderId) {
            console.warn(`Order ${order.orderNumber} is not synced to Ecwid yet. Attempting full sync.`);
            await syncOrderToEcwidHandler(ctx, { orderId: args.orderId });
            return;
        }

        let paymentStatus = "AWAITING_PAYMENT";
        let fulfillmentStatus = "AWAITING_PROCESSING";

        if (["confirmed", "processing", "shipped", "delivered"].includes(args.status)) {
            paymentStatus = "PAID";
        }

        switch (args.status) {
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

        try {
            const ECWID_API_BASE = "https://app.ecwid.com/api/v3";
            const url = `${ECWID_API_BASE}/${settings.storeId}/orders/${order.ecwidOrderId}`;

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    "Authorization": `Bearer ${settings.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    paymentStatus,
                    fulfillmentStatus,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Ecwid API error (update status): ${response.status} - ${text}`);
            }

            console.log(`Successfully updated order ${order.orderNumber} status in Ecwid.`);

        } catch (error) {
            console.error("Failed to update Ecwid order status:", error);
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
 * Internal query to get product details (for linking)
 */
export const getProductInternal = internalQuery({
    args: { productId: v.string() },
    handler: async (ctx, args) => {
        // Try getting by ID first
        try {
            // @ts-ignore
            return await ctx.db.get(args.productId);
        } catch (e) {
            return null;
        }
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

/**
 * Internal mutation to update customer with Ecwid ID
 */
export const updateCustomerEcwidId = internalMutation({
    args: {
        customerId: v.id("customers"),
        ecwidId: v.number()
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.customerId, {
            ecwidId: args.ecwidId
        });
    },
});

/**
 * Create a customer in Ecwid
 */
export const createCustomerInEcwid = action({
    args: { customerId: v.id("customers") },
    handler: async (ctx, args) => {
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) return;

        const customer = await ctx.runQuery(internal.ecwid.getCustomerInternal, { customerId: args.customerId });
        if (!customer) return;

        if (customer.ecwidId) {
            console.log("Customer already synced to Ecwid:", customer.ecwidId);
            return;
        }

        const ecwidCustomer = {
            email: customer.email,
            name: customer.name,
            billingPerson: {
                name: customer.name,
                phone: customer.phone,
                street: customer.address,
                city: customer.address.split(',')[1]?.trim() || undefined, // Simple heuristic
                company: customer.company,
            }
        };

        try {
            const response = await fetch(`https://app.ecwid.com/api/v3/${settings.storeId}/customers`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${settings.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(ecwidCustomer),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to create customer in Ecwid: ${text}`);
            }

            const result = await response.json();
            await ctx.runMutation(internal.ecwid.updateCustomerEcwidId, {
                customerId: args.customerId,
                ecwidId: result.id
            });
        } catch (error) {
            console.error(error);
        }
    }
});

/**
 * Update a customer in Ecwid
 */
export const updateCustomerInEcwid = action({
    args: { customerId: v.id("customers") },
    handler: async (ctx, args) => {
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) return;

        const customer = await ctx.runQuery(internal.ecwid.getCustomerInternal, { customerId: args.customerId });
        if (!customer || !customer.ecwidId) return; // Can't update if not synced

        const ecwidCustomer = {
            email: customer.email,
            name: customer.name,
            billingPerson: {
                name: customer.name,
                phone: customer.phone,
                street: customer.address,
                city: customer.address.split(',')[1]?.trim() || undefined,
                company: customer.company,
            }
        };

        try {
            await fetch(`https://app.ecwid.com/api/v3/${settings.storeId}/customers/${customer.ecwidId}`, {
                method: 'PUT',
                headers: {
                    "Authorization": `Bearer ${settings.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(ecwidCustomer),
            });
        } catch (error) {
            console.error("Failed to update customer in Ecwid:", error);
        }
    }
});

/**
 * Internal query to get customer details
 */
export const getCustomerInternal = internalQuery({
    args: { customerId: v.id("customers") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.customerId);
    },
});

/**
 * Internal mutation to upsert an order from Ecwid
 */
export const upsertOrderFromEcwid = internalMutation({
    args: {
        ecwidOrderId: v.union(v.string(), v.number()),
        orderNumber: v.string(),
        total: v.number(),
        subtotal: v.number(),
        tax: v.number(),
        status: v.string(),
        customerEmail: v.string(),
        customerName: v.string(),
        customerPhone: v.string(),
        customerAddress: v.string(),
        items: v.array(v.any()), // Simplified item structure for import
        createdAt: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("orders")
            .withIndex("by_ecwidOrderId", (q) => q.eq("ecwidOrderId", args.ecwidOrderId))
            .first();

        if (existing) {
            // Optional: Update status if changed
            return existing._id;
        }

        // Map Ecwid status to Convex status
        let status: any = "pending";
        if (args.status === "PAID") status = "confirmed";
        if (args.status === "SHIPPED") status = "shipped";
        if (args.status === "DELIVERED") status = "delivered";
        if (args.status === "CANCELED") status = "cancelled";

        return await ctx.db.insert("orders", {
            orderNumber: args.orderNumber.toString(),
            salesRepId: "ecwid_import", // Default system user
            salesRepName: "Ecwid Import",
            customerName: args.customerName,
            customerPhone: args.customerPhone,
            customerEmail: args.customerEmail,
            customerAddress: args.customerAddress,
            items: args.items,
            subtotal: args.subtotal,
            tax: args.tax,
            discount: 0,
            total: args.total,
            status,
            notes: "Imported from Ecwid",
            createdAt: args.createdAt,
            updatedAt: new Date().toISOString(),
            ecwidOrderId: args.ecwidOrderId,
        });
    },
});

/**
 * Fetch orders from Ecwid
 */
export const syncOrdersFromEcwid = action({
    args: {},
    handler: async (ctx) => {
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) return;

        const limit = 50;
        const url = `https://app.ecwid.com/api/v3/${settings.storeId}/orders?limit=${limit}`;

        try {
            const response = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${settings.accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) return;

            const data = await response.json();

            for (const order of data.items) {
                await ctx.runMutation(internal.ecwid.upsertOrderFromEcwid, {
                    ecwidOrderId: order.id,
                    orderNumber: order.id, // Use Ecwid ID as order number or prefix
                    total: order.total,
                    subtotal: order.subtotal,
                    tax: order.tax || 0,
                    status: order.paymentStatus === "PAID" ? "PAID" : order.fulfillmentStatus,
                    customerEmail: order.email,
                    customerName: order.billingPerson?.name || "Unknown",
                    customerPhone: order.billingPerson?.phone || "",
                    customerAddress: order.billingPerson?.street || "",
                    items: order.items.map((item: any) => ({
                        id: item.id?.toString() || Math.random().toString(),
                        productId: item.productId?.toString() || "",
                        productName: item.name,
                        productSku: item.sku || "",
                        productImage: item.imageUrl || "",
                        selectedVariations: [], // Simplify for import
                        quantity: item.quantity,
                        unitPrice: item.price,
                        totalPrice: item.price * item.quantity,
                    })),
                    createdAt: order.createDate,
                });
            }
        } catch (e) {
            console.error("Failed to sync orders from Ecwid", e);
        }
    }
});
