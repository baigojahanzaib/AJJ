import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get a single config value by key
export const getConfig = query({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const config = await ctx.db
            .query("appConfig")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();
        return config?.value ?? null;
    },
});

// Get all config values
export const getAllConfigs = query({
    args: {},
    handler: async (ctx) => {
        const configs = await ctx.db.query("appConfig").collect();
        return configs;
    },
});

// Get feature flags (convenience function)
export const getFeatureFlags = query({
    args: {},
    handler: async (ctx) => {
        const config = await ctx.db
            .query("appConfig")
            .withIndex("by_key", (q) => q.eq("key", "feature_flags"))
            .first();
        return config?.value ?? {};
    },
});

// Check maintenance mode
export const getMaintenanceStatus = query({
    args: {},
    handler: async (ctx) => {
        const config = await ctx.db
            .query("appConfig")
            .withIndex("by_key", (q) => q.eq("key", "maintenance_mode"))
            .first();
        return config?.value ?? { enabled: false, message: "" };
    },
});

// Get app update settings
export const getUpdateSettings = query({
    args: {},
    handler: async (ctx) => {
        const config = await ctx.db
            .query("appConfig")
            .withIndex("by_key", (q) => q.eq("key", "update_settings"))
            .first();
        return config?.value ?? {
            forceUpdate: false,
            minVersion: "1.0.0",
            updateMessage: "A new version is available!"
        };
    },
});

// Set a config value (admin only)
export const setConfig = mutation({
    args: {
        key: v.string(),
        value: v.any(),
        description: v.optional(v.string()),
        updatedBy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("appConfig")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        const now = new Date().toISOString();

        if (existing) {
            await ctx.db.patch(existing._id, {
                value: args.value,
                description: args.description ?? existing.description,
                updatedAt: now,
                updatedBy: args.updatedBy,
            });
            return existing._id;
        } else {
            const id = await ctx.db.insert("appConfig", {
                key: args.key,
                value: args.value,
                description: args.description ?? "",
                updatedAt: now,
                updatedBy: args.updatedBy,
            });
            return id;
        }
    },
});

// Delete a config value (admin only)
export const deleteConfig = mutation({
    args: { key: v.string() },
    handler: async (ctx, args) => {
        const config = await ctx.db
            .query("appConfig")
            .withIndex("by_key", (q) => q.eq("key", args.key))
            .first();

        if (config) {
            await ctx.db.delete(config._id);
            return true;
        }
        return false;
    },
});

// Seed default configs
export const seedDefaultConfigs = mutation({
    args: {},
    handler: async (ctx) => {
        const defaultConfigs = [
            {
                key: "feature_flags",
                value: {
                    enableOfflineMode: true,
                    enableNotifications: true,
                    enableProductSearch: true,
                    enableOrderEditing: true,
                },
                description: "Feature toggles for the app",
            },
            {
                key: "maintenance_mode",
                value: {
                    enabled: false,
                    message: "We're currently performing maintenance. Please try again later.",
                    allowedUserIds: [],
                },
                description: "Maintenance mode settings",
            },
            {
                key: "update_settings",
                value: {
                    forceUpdate: false,
                    minVersion: "1.0.0",
                    updateMessage: "A new version is available! Please update to continue.",
                },
                description: "App update prompts and requirements",
            },
            {
                key: "app_announcement",
                value: {
                    enabled: false,
                    title: "",
                    message: "",
                    type: "info", // info, warning, success
                    dismissible: true,
                },
                description: "In-app announcements banner",
            },
        ];

        const now = new Date().toISOString();

        for (const config of defaultConfigs) {
            const existing = await ctx.db
                .query("appConfig")
                .withIndex("by_key", (q) => q.eq("key", config.key))
                .first();

            if (!existing) {
                await ctx.db.insert("appConfig", {
                    ...config,
                    updatedAt: now,
                });
            }
        }

        return { success: true, message: "Default configs seeded" };
    },
});
