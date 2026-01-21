import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Variation option schema (nested in products)
const variationOptionValidator = v.object({
    id: v.string(),
    name: v.string(),
    priceModifier: v.number(),
    sku: v.string(),
    moq: v.optional(v.number()),
    stock: v.number(),
    image: v.optional(v.string()),
});

// Product variation schema (nested in products)
const productVariationValidator = v.object({
    id: v.string(),
    name: v.string(),
    options: v.array(variationOptionValidator),
});

// Selected variation for cart/orders
const selectedVariationValidator = v.object({
    variationId: v.string(),
    variationName: v.string(),
    optionId: v.string(),
    optionName: v.string(),
    priceModifier: v.number(),
});

// Order item schema (nested in orders)
const orderItemValidator = v.object({
    id: v.string(),
    productId: v.string(),
    productName: v.string(),
    productSku: v.string(),
    productImage: v.string(),
    selectedVariations: v.array(selectedVariationValidator),
    quantity: v.number(),
    unitPrice: v.number(),
    totalPrice: v.number(),
});

// Order edit log schema (nested in orders)
const orderEditLogValidator = v.object({
    editedAt: v.string(),
    editedBy: v.string(),
    editedByName: v.string(),
    changes: v.string(),
});

export default defineSchema({
    users: defineTable({
        email: v.string(),
        passwordHash: v.string(),
        name: v.string(),
        role: v.union(v.literal("admin"), v.literal("sales_rep")),
        phone: v.string(),
        avatar: v.optional(v.string()),
        isActive: v.boolean(),
        createdAt: v.string(),
    }).index("by_email", ["email"]),

    categories: defineTable({
        name: v.string(),
        description: v.string(),
        image: v.optional(v.string()),
        parentId: v.optional(v.string()),
        isActive: v.boolean(),
        createdAt: v.string(),
        // Ecwid integration
        ecwidId: v.optional(v.number()),
    }).index("by_ecwidId", ["ecwidId"]),

    products: defineTable({
        name: v.string(),
        description: v.string(),
        sku: v.string(),
        basePrice: v.number(),
        compareAtPrice: v.optional(v.number()),
        images: v.array(v.string()),
        categoryId: v.string(),
        isActive: v.boolean(),
        variations: v.array(productVariationValidator),
        stock: v.number(),
        moq: v.optional(v.number()),
        // Ecwid ribbon/promotion tag
        ribbon: v.optional(v.string()),
        ribbonColor: v.optional(v.string()),
        createdAt: v.string(),
        // Ecwid integration
        ecwidId: v.optional(v.number()),
    })
        .index("by_category", ["categoryId"])
        .index("by_sku", ["sku"])
        .index("by_ecwidId", ["ecwidId"])
        .index("by_ribbon", ["ribbon"]),

    customers: defineTable({
        name: v.string(),
        phone: v.string(),
        email: v.string(),
        address: v.string(),
        // Location coordinates
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        company: v.optional(v.string()),
        isActive: v.boolean(),
        createdAt: v.string(),
    }).index("by_email", ["email"]),

    orders: defineTable({
        orderNumber: v.string(),
        salesRepId: v.string(),
        salesRepName: v.string(),
        customerName: v.string(),
        customerPhone: v.string(),
        customerEmail: v.string(),
        customerAddress: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        items: v.array(orderItemValidator),
        subtotal: v.number(),
        tax: v.number(),
        discount: v.number(),
        total: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("confirmed"),
            v.literal("processing"),
            v.literal("shipped"),
            v.literal("delivered"),
            v.literal("cancelled")
        ),
        notes: v.string(),
        createdAt: v.string(),
        updatedAt: v.string(),
        previousVersion: v.optional(v.any()),
        editLog: v.optional(v.array(orderEditLogValidator)),
        ecwidOrderId: v.optional(v.union(v.string(), v.number())),
    })
        .index("by_salesRep", ["salesRepId"])
        .index("by_status", ["status"])
        .index("by_orderNumber", ["orderNumber"])
        .index("by_ecwidOrderId", ["ecwidOrderId"]),

    // Ecwid integration settings (singleton table - only one record)
    ecwidSettings: defineTable({
        storeId: v.string(),
        accessToken: v.string(),
        autoSyncEnabled: v.boolean(),
        syncIntervalHours: v.number(),
        lastSyncAt: v.optional(v.string()),
        lastSyncStatus: v.optional(v.union(
            v.literal("success"),
            v.literal("error"),
            v.literal("in_progress")
        )),
        lastSyncMessage: v.optional(v.string()),
        lastSyncProductCount: v.optional(v.number()),
        lastSyncCategoryCount: v.optional(v.number()),
    }),

    // App remote configuration (feature flags, maintenance mode, etc.)
    appConfig: defineTable({
        key: v.string(),
        value: v.any(),
        description: v.string(),
        updatedAt: v.string(),
        updatedBy: v.optional(v.string()),
    }).index("by_key", ["key"]),
});
