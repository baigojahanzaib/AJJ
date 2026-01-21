import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Validators for order items
const selectedVariationValidator = v.object({
    variationId: v.string(),
    variationName: v.string(),
    optionId: v.string(),
    optionName: v.string(),
    priceModifier: v.number(),
});

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

const orderEditLogValidator = v.object({
    editedAt: v.string(),
    editedBy: v.string(),
    editedByName: v.string(),
    changes: v.string(),
});

// List all orders
export const list = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("orders").collect();
    },
});

// Get order by ID
export const getById = query({
    args: { id: v.id("orders") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

// Get orders by sales rep
export const bySalesRep = query({
    args: { salesRepId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("orders")
            .withIndex("by_salesRep", (q) => q.eq("salesRepId", args.salesRepId))
            .collect();
    },
});

// Get orders by status
export const byStatus = query({
    args: { status: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("orders")
            .withIndex("by_status", (q) => q.eq("status", args.status as any))
            .collect();
    },
});

// Generate order number
async function generateOrderNumber(ctx: any): Promise<string> {
    const year = new Date().getFullYear();
    const orders = await ctx.db.query("orders").collect();
    const nextNumber = orders.length + 1;
    return `ORD-${year}-${nextNumber.toString().padStart(4, "0")}`;
}

// Create a new order
export const create = mutation({
    args: {
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
    },
    handler: async (ctx, args) => {
        const orderNumber = await generateOrderNumber(ctx);
        const now = new Date().toISOString();

        const orderId = await ctx.db.insert("orders", {
            ...args,
            orderNumber,
            createdAt: now,
            updatedAt: now,
        });

        // Trigger Ecwid sync
        await ctx.scheduler.runAfter(0, api.ecwid.syncOrderToEcwid, {
            orderId,
        });

        return orderId;
    },
});

// Update order status
export const updateStatus = mutation({
    args: {
        id: v.id("orders"),
        status: v.union(
            v.literal("pending"),
            v.literal("confirmed"),
            v.literal("processing"),
            v.literal("shipped"),
            v.literal("delivered"),
            v.literal("cancelled")
        ),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            status: args.status,
            updatedAt: new Date().toISOString(),
        });
        return await ctx.db.get(args.id);
    },
});

// Full order update with edit log
export const update = mutation({
    args: {
        id: v.id("orders"),
        editedBy: v.string(),
        editedByName: v.string(),
        changeDescription: v.string(),
        customerName: v.optional(v.string()),
        customerPhone: v.optional(v.string()),
        customerEmail: v.optional(v.string()),
        customerAddress: v.optional(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        items: v.optional(v.array(orderItemValidator)),
        subtotal: v.optional(v.number()),
        tax: v.optional(v.number()),
        discount: v.optional(v.number()),
        total: v.optional(v.number()),
        notes: v.optional(v.string()),
        status: v.optional(
            v.union(
                v.literal("pending"),
                v.literal("confirmed"),
                v.literal("processing"),
                v.literal("shipped"),
                v.literal("delivered"),
                v.literal("cancelled")
            )
        ),
    },
    handler: async (ctx, args) => {
        const { id, editedBy, editedByName, changeDescription, ...updates } = args;

        const currentOrder = await ctx.db.get(id);
        if (!currentOrder) throw new Error("Order not found");

        // Create edit log entry
        const newEditLog = {
            editedAt: new Date().toISOString(),
            editedBy,
            editedByName,
            changes: changeDescription,
        };

        // Store previous version (without edit history to avoid recursion)
        const { previousVersion: _, editLog: __, ...currentOrderData } = currentOrder;

        // Filter out undefined values
        const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
        );

        await ctx.db.patch(id, {
            ...cleanUpdates,
            updatedAt: new Date().toISOString(),
            previousVersion: currentOrderData,
            editLog: [...(currentOrder.editLog || []), newEditLog],
        });

        return await ctx.db.get(id);
    },
});

// Undo last edit
export const undoEdit = mutation({
    args: { id: v.id("orders") },
    handler: async (ctx, args) => {
        const order = await ctx.db.get(args.id);
        if (!order || !order.previousVersion) {
            throw new Error("No previous version to restore");
        }

        const { previousVersion, editLog } = order;

        await ctx.db.patch(args.id, {
            ...previousVersion,
            updatedAt: new Date().toISOString(),
            previousVersion: undefined,
            editLog: editLog?.slice(0, -1),
        });

        return await ctx.db.get(args.id);
    },
});

// Get dashboard stats
export const getDashboardStats = query({
    args: {},
    handler: async (ctx) => {
        const orders = await ctx.db.query("orders").collect();
        const products = await ctx.db.query("products").collect();
        const users = await ctx.db.query("users").collect();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const ordersThisMonth = orders.filter(
            (o) => new Date(o.createdAt) >= startOfMonth
        );
        const pendingOrders = orders.filter((o) => o.status === "pending").length;

        return {
            totalOrders: orders.length,
            totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
            totalProducts: products.length,
            totalUsers: users.filter((u) => u.role === "sales_rep").length,
            pendingOrders,
            ordersThisMonth: ordersThisMonth.length,
            revenueThisMonth: ordersThisMonth.reduce((sum, o) => sum + o.total, 0),
        };
    },
});
