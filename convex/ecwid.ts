// ... imports
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { extractEcwidMoq } from "./ecwidMoq";

export const inspectProduct = query({
    args: { sku: v.string() },
    handler: async (ctx, args) => {
        const product = await ctx.db
            .query("products")
            .withIndex("by_sku", (q) => q.eq("sku", args.sku))
            .first();
        return product;
    },
});

export const checkCombinationsExist = query({
    args: { sku: v.string() },
    handler: async (ctx, args) => {
        const product = await ctx.db
            .query("products")
            .withIndex("by_sku", (q) => q.eq("sku", args.sku))
            .first();
        return {
            sku: args.sku,
            found: !!product,
            hasCombinations: !!product?.combinations,
            combinationsCount: product?.combinations?.length
        };
    },
});

export const inspectEcwidProduct = action({
    args: { productId: v.number() },
    handler: async (ctx, args) => {
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings) throw new Error("No settings");

        // Fetch specific product by ID
        const url = `https://app.ecwid.com/api/v3/${settings.storeId}/products/${args.productId}`;
        console.log("Fetching Product URL:", url);
        const response: any = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${settings.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error("Fetch failed:", await response.text());
            return { error: response.status };
        }

        const item: any = await response.json();
        /*
        if (item) {
            console.log("Item Combinations:", item.combinations ? "Present" : "MISSING");
            return { hasCombinations: !!item.combinations, combinationsCount: item.combinations?.length };
        }
        */
        return item;

        return { error: "No items found" };
    },
});

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
        lastSyncedAt: v.optional(v.string()),
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
                // Even if no content changes, we MUST update lastSyncedAt to prevent cleanup
                if (args.lastSyncedAt) {
                    await ctx.db.patch(existing._id, {
                        lastSyncedAt: args.lastSyncedAt
                    });
                }
                return existing._id;
            }

            await ctx.db.patch(existing._id, {
                name: args.name,
                description: args.description,
                image: args.image,
                parentId,
                isActive: args.isActive,
                lastSyncedAt: args.lastSyncedAt,
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
                lastSyncedAt: args.lastSyncedAt,
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
        lastSyncedAt: v.optional(v.string()),
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
                // Even if no content changes, we MUST update lastSyncedAt to prevent cleanup
                if (args.lastSyncedAt) {
                    await ctx.db.patch(existing._id, {
                        lastSyncedAt: args.lastSyncedAt
                    });
                }
                return existing._id;
            }

            await ctx.db.patch(existing._id, {
                name: args.name,
                phone: args.phone,
                address: fullAddress,
                company: args.company,
                ecwidId: args.ecwidId,
                lastSyncedAt: args.lastSyncedAt,
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
                lastSyncedAt: args.lastSyncedAt,
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
                moq: v.optional(v.number()),
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
        lastSyncedAt: v.optional(v.string()),
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

        // If no category found, use "Uncategorized" category (check by name first to avoid race condition)
        if (!categoryId) {
            // First, try to find existing "Uncategorized" category to avoid race conditions
            const uncategorized = await ctx.db
                .query("categories")
                .filter(q => q.eq(q.field("name"), "Uncategorized"))
                .first();

            if (uncategorized) {
                categoryId = uncategorized._id;
            } else {
                // Fallback: try any category
                const anyCategory = await ctx.db.query("categories").first();
                if (anyCategory) {
                    categoryId = anyCategory._id;
                } else {
                    // Last resort: create Uncategorized (rare race condition possible, but much less likely)
                    categoryId = await ctx.db.insert("categories", {
                        name: "Uncategorized",
                        description: "Products without a category",
                        isActive: true,
                        createdAt: new Date().toISOString(),
                    });
                }
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
                JSON.stringify(existing.combinations) === JSON.stringify(args.combinations) &&
                existing.stock === args.stock &&
                existing.ribbon === args.ribbon &&
                existing.ribbonColor === args.ribbonColor &&
                existing.moq === args.moq
            ) {
                // No changes, skip write but update lastSyncedAt
                if (args.lastSyncedAt) {
                    await ctx.db.patch(existing._id, { lastSyncedAt: args.lastSyncedAt });
                }
                return existing._id;
            }

            // Preserve per-variation MOQ values set locally (e.g. via batchUpdateMOQ).
            // Ecwid doesn't store our custom MOQ data, so merge existing MOQ back in by SKU.
            const existingOptsBySkuMap = new Map<string, number>();
            if (existing.variations) {
                for (const v of (existing.variations as any[])) {
                    for (const o of (v.options as any[])) {
                        if (o.sku && o.moq !== undefined) {
                            existingOptsBySkuMap.set(o.sku, o.moq);
                        }
                    }
                }
            }

            const mergedVariations = args.variations.map((incomingVar: any) => ({
                ...incomingVar,
                options: incomingVar.options.map((incomingOpt: any) => {
                    const existingMoq = existingOptsBySkuMap.get(incomingOpt.sku);
                    return existingMoq !== undefined
                        ? { ...incomingOpt, moq: existingMoq }
                        : incomingOpt;
                }),
            }));

            // Preserve product-level MOQ if Ecwid doesn't provide one
            const resolvedMoq = args.moq !== undefined ? args.moq : existing.moq;

            const updates: any = {
                name: args.name,
                description: args.description,
                sku: args.sku,
                basePrice: args.basePrice,
                compareAtPrice: args.compareAtPrice,
                images: args.images,
                categoryId,
                isActive: args.isActive,
                variations: mergedVariations,
                combinations: args.combinations,
                stock: args.stock,
                ribbon: args.ribbon,
                ribbonColor: args.ribbonColor,
                moq: resolvedMoq,
                updatedAt: new Date().toISOString(),
            };

            if (args.lastSyncedAt) {
                updates.lastSyncedAt = args.lastSyncedAt;
            }

            await ctx.db.patch(existing._id, updates);
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
                lastSyncedAt: args.lastSyncedAt,
            });
        }
    },
});

/**
 * Delete products that haven't been synced since a specific time
 */
export const deleteStaleProducts = internalMutation({
    args: { syncedBefore: v.string() },
    handler: async (ctx, args) => {
        const products = await ctx.db.query("products")
            .withIndex("by_ecwidId")
            .filter(q => q.neq(q.field("ecwidId"), undefined))
            .collect();

        let deletedCount = 0;
        for (const product of products) {
            if (!product.lastSyncedAt || product.lastSyncedAt < args.syncedBefore) {
                await ctx.db.delete(product._id);
                deletedCount++;
            }
        }
        console.log(`Deleted ${deletedCount} stale products.`);
        return deletedCount;
    },
});

/**
 * Delete categories that haven't been synced since a specific time
 */
export const deleteStaleCategories = internalMutation({
    args: { syncedBefore: v.string() },
    handler: async (ctx, args) => {
        const categories = await ctx.db.query("categories")
            .withIndex("by_ecwidId")
            .filter(q => q.neq(q.field("ecwidId"), undefined))
            .collect();

        let deletedCount = 0;
        for (const cat of categories) {
            if (!cat.lastSyncedAt || cat.lastSyncedAt < args.syncedBefore) {
                await ctx.db.delete(cat._id);
                deletedCount++;
            }
        }
        console.log(`Deleted ${deletedCount} stale categories.`);
        return deletedCount;
    },
});

// ============================================================================
// Sync Action
// ============================================================================

/**
 * Full sync from Ecwid - fetches categories, products, and customers
 */
export const fullSync = action({
    args: { force: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
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
        const updatedFromParam = (lastSyncTime > 0 && !args.force) ? `&updatedFrom=${Math.floor(lastSyncTime)}` : "";

        const syncStartTime = new Date().toISOString();
        console.log(`Starting sync. Force: ${args.force}, LastSync: ${lastSyncTime}, Param: ${updatedFromParam}, SyncStart: ${syncStartTime}`);

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
                        lastSyncedAt: syncStartTime,
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
                    if (JSON.stringify(prod).includes("TGS-PY-053")) {
                        console.log("DEBUG: FOUND TGS-PY-053 in Ecwid Data!");
                        console.log("Product Name:", prod.name);
                        console.log("Product ID:", prod.id);
                        console.log("Product SKU:", prod.sku);
                    }
                    // Build images array
                    const images: string[] = [];
                    if (prod.imageUrl) images.push(prod.imageUrl);
                    if (prod.galleryImages) {
                        images.push(...prod.galleryImages.map((img: any) => img.url));
                    }
                    if (images.length === 0) {
                        images.push("https://via.placeholder.com/300");
                    }

                    // Analyze combinations to find consistent images for variations
                    const optionValueImages = new Map<string, Set<string>>();

                    if (prod.combinations && prod.combinations.length > 0) {
                        for (const comb of prod.combinations) {
                            if (comb.imageUrl && comb.options) {
                                for (const opt of comb.options) {
                                    const key = `${opt.name?.trim().toLowerCase()}:${opt.value?.trim().toLowerCase()}`;
                                    if (!optionValueImages.has(key)) {
                                        optionValueImages.set(key, new Set());
                                    }
                                    optionValueImages.get(key)?.add(comb.imageUrl);
                                }
                            }
                        }
                    }

                    // Perform debug logging for a specific product or if combinations exist
                    if (prod.combinations && prod.combinations.length > 0 && prod.options?.length > 0) {
                        console.log(`[Sync Debug] Product: ${prod.name} (${prod.id})`);
                        console.log(`[Sync Debug] Combinations: ${prod.combinations.length}`);
                        // console.log(`[Sync Debug] Options: ${prod.options.map((o: any) => o.name).join(', ')}`);
                        // console.log(`[Sync Debug] Mapped Images Keys: ${Array.from(optionValueImages.keys()).join(', ')}`);
                    }

                    // Build variations from options
                    const variations: any[] = [];
                    if (prod.options && prod.options.length > 0) {
                        for (const option of prod.options) {
                            const convexVariation = {
                                id: `opt-${option.name.trim().toLowerCase().replace(/\s+/g, '-')}`,
                                name: option.name?.trim(),
                                options: (option.choices || []).map((choice: any, index: number) => {
                                    let priceModifier = choice.priceModifier || 0;
                                    if (choice.priceModifierType === "PERCENT") {
                                        priceModifier = (prod.price * priceModifier) / 100;
                                    }

                                    // Determine image
                                    const key = `${option.name.trim().toLowerCase()}:${choice.text?.trim().toLowerCase()}`;
                                    const images = optionValueImages.get(key);
                                    let image: string | undefined = undefined;

                                    // Only assign image if ALL combinations with this option value have the SAME image (or if there's only one)
                                    // This prevents assigning "Red" shirt image to "Small" size if "Small" comes in both Red and Blue.
                                    if (images && images.size === 1) {
                                        image = Array.from(images)[0];
                                    }

                                    return {
                                        id: `${option.name.trim().toLowerCase().replace(/\s+/g, '-')}-${index}`,
                                        name: choice.text?.trim(),
                                        priceModifier,
                                        sku: prod.sku ? `${prod.sku}-${choice.text?.trim()}` : `SKU-${index}`,
                                        stock: prod.quantity || 0,
                                        image: image,
                                    };
                                }),
                            };
                            variations.push(convexVariation);
                        }
                    }

                    // Strip HTML from description
                    const description = (prod.description || "").replace(/<[^>]*>/g, '').trim();

                    const moq = extractEcwidMoq(prod);

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
                                name: o.name?.trim(),
                                value: o.value?.trim()
                            })) || [],
                            price: c.price !== undefined && c.price !== null ? c.price : (prod.price || 0),
                            sku: c.sku,
                            stock: c.quantity
                        })),
                        stock: prod.quantity || 0,
                        ribbon: prod.ribbon?.text,
                        ribbonColor: prod.ribbon?.color,
                        moq,
                        lastSyncedAt: syncStartTime,
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
                        lastSyncedAt: syncStartTime,
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
                successfulSyncTime: syncStartTime,
            });

            // CLEANUP PHASE
            // Only perform cleanup if we did a full sync (no updatedFrom param) or if forced
            if (!updatedFromParam || args.force) {
                console.log("Performing cleanup of stale data...");
                await ctx.runMutation(internal.ecwid.deleteStaleProducts, { syncedBefore: syncStartTime });
                await ctx.runMutation(internal.ecwid.deleteStaleCategories, { syncedBefore: syncStartTime });
                // Note: We might want to be careful with customers as they might be created locally too?
                // Current logic assumes customers in DB with ecwidId MUST exist in Ecwid. 
            }

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
 * Sync customers from Ecwid (Manual trigger)
 */
export const syncCustomers = action({
    args: {},
    handler: async (ctx) => {
        // Get settings
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) {
            throw new Error("Ecwid is not configured. Please add Store ID and Access Token.");
        }

        console.log("Starting manual customer sync...");

        const ECWID_API_BASE = "https://app.ecwid.com/api/v3";
        let customerCount = 0;
        let offset = 0;
        const limit = 100;

        try {
            while (true) {
                const custUrl = `${ECWID_API_BASE}/${settings.storeId}/customers?offset=${offset}&limit=${limit}`;
                const custResponse = await fetch(custUrl, {
                    headers: {
                        "Authorization": `Bearer ${settings.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!custResponse.ok) {
                    const errorText = await custResponse.text();
                    throw new Error(`Ecwid API error (customers): ${custResponse.status} - ${errorText}`);
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

            console.log(`Successfully synced ${customerCount} customers.`);
            return { success: true, count: customerCount };

        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error("Customer sync failed:", message);
            throw error;
        }
    },
});

/**
 * Sync an order to Ecwid
 */
const normalizeOptionText = (value: string | undefined): string => (value ?? "").trim().toLowerCase();

const findMatchingCombination = (product: any, selectedVariations: any[]): any | undefined => {
    if (!product?.combinations || !selectedVariations.length) {
        return undefined;
    }

    const selectedByName = new Map<string, string>();
    for (const selected of selectedVariations) {
        const optionName = normalizeOptionText(selected?.variationName);
        const optionValue = normalizeOptionText(selected?.optionName);
        if (optionName && optionValue) {
            selectedByName.set(optionName, optionValue);
        }
    }

    if (selectedByName.size === 0) {
        return undefined;
    }

    return (product.combinations as any[]).find((combo: any) => {
        const comboOptions = Array.isArray(combo?.options) ? combo.options : [];
        if (!comboOptions.length || comboOptions.length !== selectedByName.size) {
            return false;
        }

        return comboOptions.every((comboOption: any) => {
            const comboName = normalizeOptionText(comboOption?.name);
            const comboValue = normalizeOptionText(comboOption?.value);
            return comboName && comboValue && selectedByName.get(comboName) === comboValue;
        });
    });
};

const toEcwidSelectedOptions = (selectedVariations: any[]): any[] => {
    if (!selectedVariations.length) {
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
        let combinationId: number | undefined;
        const selectedVariations = Array.isArray(item.selectedVariations) ? item.selectedVariations : [];
        const selectedOptions = toEcwidSelectedOptions(selectedVariations);

        if (item.productId) {
            const product = await ctx.runQuery(internal.ecwid.getProductInternal, {
                productId: item.productId
            });
            if (product && product.ecwidId) {
                productId = product.ecwidId;
                // Find the correct variation SKU from combinations based on selectedVariations
                if (product.combinations && selectedVariations.length > 0) {
                    const match = findMatchingCombination(product, selectedVariations);
                    if (match?.sku) {
                        sku = match.sku;
                    }
                    if (match?.id !== undefined && match?.id !== null) {
                        const parsedCombinationId = typeof match.id === "number" ? match.id : Number(match.id);
                        if (Number.isFinite(parsedCombinationId)) {
                            combinationId = parsedCombinationId;
                        }
                    }
                }
            }
        }

        const ecwidItem: any = {
            name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
            sku: sku,
            productId: productId,
        };

        if (selectedOptions.length > 0) {
            ecwidItem.selectedOptions = selectedOptions;
        }

        if (combinationId !== undefined) {
            ecwidItem.combinationId = combinationId;
        }

        return ecwidItem;
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

        // Update order with Ecwid ID and lastSyncedAt
        await ctx.runMutation(internal.ecwid.updateOrderEcwidId, {
            orderId: args.orderId,
            ecwidOrderId: result.id,
            lastSyncedAt: new Date().toISOString()
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
        const statuses = ["pending", "confirmed", "processing", "shipped", "delivered"];
        const results = await Promise.all(
            statuses.map(status =>
                ctx.db
                    .query("orders")
                    .withIndex("by_status", (q) => q.eq("status", status as any))
                    .collect()
            )
        );

        // Flatten and filter for those not yet synced
        const allOrders = results.flat();
        return allOrders.filter((o: any) => !o.ecwidOrderId);
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
        ecwidOrderId: v.union(v.string(), v.number()),
        lastSyncedAt: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const patch: any = {
            ecwidOrderId: args.ecwidOrderId
        };
        if (args.lastSyncedAt) {
            patch.lastSyncedAt = args.lastSyncedAt;
        }
        await ctx.db.patch(args.orderId, patch);
    },
});

/**
 * Backfill existing orders to Ecwid (Manual Trigger)
 */
export const backfillOrders = internalMutation({
    args: {},
    handler: async (ctx) => {
        const statuses = ["pending", "confirmed", "processing", "shipped", "delivered"];
        const results = await Promise.all(
            statuses.map(status =>
                ctx.db
                    .query("orders")
                    .withIndex("by_status", (q) => q.eq("status", status as any))
                    .collect()
            )
        );
        const orders = results.flat();

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
 * Perform full manual sync (Customers, Products, Categories, Orders IN & OUT)
 */
export const performManualSync = action({
    args: {},
    handler: async (ctx) => {
        console.log("Starting Manual Sync...");

        try {
            // 1. Pull Customers, Categories, Products
            console.log("Pulling Customers, Categories, Products...");
            await ctx.runAction(api.ecwid.fullSync, { force: true });
            console.log("Full sync finished.");
        } catch (e) {
            console.error("Full Sync Failed:", e);
        }



        try {
            // 3. Push Pending Orders (Backfill)
            console.log("Pushing Pending Orders to Ecwid...");
            await ctx.runAction(api.ecwid.syncPendingOrders);
            console.log("Pending push finished.");
        } catch (e) {
            console.error("Pending Push Failed:", e);
        }

        console.log("Manual Sync Completed (check logs for partial failures).");
        return "Sync Process Finished";
    }
});

/**
 * Sync a single product by Ecwid ID
 */
export const syncProduct = action({
    args: { ecwidId: v.number() },
    handler: async (ctx, args) => {
        const settings = await ctx.runQuery(internal.ecwid.getSettingsInternal);
        if (!settings || !settings.storeId || !settings.accessToken) {
            throw new Error("Ecwid is not configured");
        }

        const url = `https://app.ecwid.com/api/v3/${settings.storeId}/products/${args.ecwidId}`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${settings.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch product: ${response.status}`);
        }

        const prod: any = await response.json();
        console.log(`Synced product ${prod.id}. Combinations: ${prod.combinations?.length}`);

        // Build variations/combinations logic (copied from fullSync, but simplified)

        // Build images
        const images: string[] = [];
        if (prod.imageUrl) images.push(prod.imageUrl);
        if (prod.galleryImages) {
            images.push(...prod.galleryImages.map((img: any) => img.url));
        }
        if (images.length === 0) images.push("https://via.placeholder.com/300");

        // Build variations
        const variations: any[] = [];
        if (prod.options && prod.options.length > 0) {
            for (const option of prod.options) {
                const convexVariation = {
                    id: `opt-${option.name.trim().toLowerCase().replace(/\s+/g, '-')}`,
                    name: option.name?.trim(),
                    options: (option.choices || []).map((choice: any, index: number) => {
                        let priceModifier = choice.priceModifier || 0;
                        if (choice.priceModifierType === "PERCENT") {
                            priceModifier = (prod.price * priceModifier) / 100;
                        }
                        return {
                            id: `${option.name.trim().toLowerCase().replace(/\s+/g, '-')}-${index}`,
                            name: choice.text?.trim(),
                            priceModifier,
                            sku: prod.sku ? `${prod.sku}-${choice.text?.trim()}` : `SKU-${index}`,
                            stock: prod.quantity || 0,
                        };
                    }),
                };
                variations.push(convexVariation);
            }
        }

        const description = (prod.description || "").replace(/<[^>]*>/g, '').trim();

        // Upsert
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
                    name: o.name?.trim(),
                    value: o.value?.trim()
                })) || [],
                price: c.price !== undefined && c.price !== null ? c.price : (prod.price || 0),
                sku: c.sku,
                stock: c.quantity
            })),
            stock: prod.quantity || 0,
            ribbon: prod.ribbon?.text,
            ribbonColor: prod.ribbon?.color,
            moq: extractEcwidMoq(prod)
        });

        return { success: true, name: prod.name };
    }
});




export const inspectBooster = action({
    handler: async (ctx): Promise<any> => {
        const result = await ctx.runAction(api.ecwid.inspectEcwidProduct, { productId: 215080965 });
        const combinations = (result as any).combinations || [];
        const options = (result as any).options || [];
        console.log("INSPECT RESULT combinations count:", combinations.length);
        if (combinations.length > 0) {
            console.log("First Combination:", JSON.stringify(combinations[0], null, 2));
        }
        console.log("Options:", JSON.stringify(options, null, 2));
        return result;
    },
});
