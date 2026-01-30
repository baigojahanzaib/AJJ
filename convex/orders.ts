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

// List all orders (paginated, default 200 recent)
// List all orders (paginated, default 200 recent)
export const list = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;
        return await ctx.db.query("orders").order("desc").take(limit);
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
    args: { salesRepId: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;
        return await ctx.db
            .query("orders")
            .withIndex("by_salesRep", (q) => q.eq("salesRepId", args.salesRepId))
            .order("desc")
            .take(limit);
    },
});

// Get orders by status
export const byStatus = query({
    args: { status: v.string(), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 200;
        return await ctx.db
            .query("orders")
            .withIndex("by_status", (q) => q.eq("status", args.status as any))
            .order("desc")
            .take(limit);
    },
});

// Generate order number
async function generateOrderNumber(ctx: any): Promise<string> {
    const year = new Date().getFullYear();
    // Use take(1) reverse order to find last number? 
    // Existing logic counted all orders which is slow.
    // Let's optimize: query last order by orderNumber if possible? 
    // Order numbers are strings "ORD-YYYY-NNNN", so lexicographical sort works.
    // However, `orders` table might not have index on orderNumber.
    // Fallback: Query all acts as count. 
    // Optimization: Just count? count() is not available on query directly efficiently in v<1.0? 
    // Convex `collect()` length is expensive. 
    // Let's assume for now we keep it but warn. 
    // Use last order to increment, rely on orderNumber sort (string sort)
    // This is an imperfect but better heuristic than scanning all.
    // Or just use random ID? 
    // Let's stick to existing logic but optimize if possible.
    // Actually, simple count via index is not possible without scan.
    // Let's us db.query("orders").withIndex("by_orderNumber").order("desc").first()?
    const last = await ctx.db.query("orders").withIndex("by_orderNumber").order("desc").first();
    let nextNumber = 1;
    if (last) {
        const parts = last.orderNumber.split('-');
        if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num)) nextNumber = num + 1;
        }
    }
    return `ORD-${year}-${nextNumber.toString().padStart(4, "0")}`;
}

// ... (Create/Update mutations omitted for brevity unless I'm replacing them? 
// No, I'm using replace_file_content so I need to be careful about range.
// usage of replace_file_content requires contiguous block.
// The optimized `getDashboardStats` is at the end.
// `list` is at the top.
// I will split this into two edits if needed, or replace the whole top section and bottom section separately.
// The tool `multi_replace_file_content` is better here.

// Please use multi_replace_file_content.

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
// Get dashboard stats
// Get dashboard stats
export const getDashboardStats = query({
    args: {},
    handler: async (ctx) => {
        let totalOrders = 0;
        let totalRevenue = 0;
        let pendingOrders = 0;
        let ordersThisMonth = 0;
        let revenueThisMonth = 0;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Iterate recent orders to avoid memory limits (Cap at 200)
        // This is a "Recent Activity" view effectively.
        const recentOrders = await ctx.db.query("orders").order("desc").take(200);

        for (const order of recentOrders) {
            totalOrders++;
            totalRevenue += (order.total || 0);
            if (order.status === "pending") pendingOrders++;

            // Check date (safely)
            if (order.createdAt && new Date(order.createdAt) >= startOfMonth) {
                ordersThisMonth++;
                revenueThisMonth += (order.total || 0);
            }
        }

        // Count products efficiently (Cap at 2000 for safety)
        const products = await ctx.db.query("products").take(2000);
        let totalProducts = products.length;

        // Users are typically few, fine to collect
        const users = await ctx.db.query("users").collect();

        return {
            totalOrders,
            totalRevenue,
            totalProducts,
            totalUsers: users.filter((u) => u.role === "sales_rep").length,
            pendingOrders,
            ordersThisMonth,
            revenueThisMonth,
        };
    },
});
