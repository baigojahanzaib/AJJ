import { mutation } from "./_generated/server";

// Seed the database with initial mock data
export const seedDatabase = mutation({
    args: {},
    handler: async (ctx) => {
        // Check if data already exists
        const existingUsers = await ctx.db.query("users").first();
        if (existingUsers) {
            return { success: false, message: "Database already seeded" };
        }

        // Seed Users
        const users = [
            {
                email: "admin@company.com",
                passwordHash: "admin123",
                name: "John Administrator",
                role: "admin" as const,
                phone: "+1 (555) 100-0001",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
                isActive: true,
                createdAt: "2024-01-01T00:00:00Z",
            },
            {
                email: "sarah@company.com",
                passwordHash: "sales123",
                name: "Sarah Mitchell",
                role: "sales_rep" as const,
                phone: "+1 (555) 200-0001",
                avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
                isActive: true,
                createdAt: "2024-01-15T00:00:00Z",
            },
            {
                email: "michael@company.com",
                passwordHash: "sales123",
                name: "Michael Chen",
                role: "sales_rep" as const,
                phone: "+1 (555) 200-0002",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
                isActive: true,
                createdAt: "2024-02-01T00:00:00Z",
            },
            {
                email: "emily@company.com",
                passwordHash: "sales123",
                name: "Emily Rodriguez",
                role: "sales_rep" as const,
                phone: "+1 (555) 200-0003",
                avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
                isActive: true,
                createdAt: "2024-02-15T00:00:00Z",
            },
        ];

        for (const user of users) {
            await ctx.db.insert("users", user);
        }

        // Seed Categories
        const categories = [
            { name: "Electronics", description: "Electronic devices and accessories", isActive: true, createdAt: "2024-01-01T00:00:00Z" },
            { name: "Clothing", description: "Apparel and fashion items", isActive: true, createdAt: "2024-01-01T00:00:00Z" },
            { name: "Home & Garden", description: "Home decor and garden items", isActive: true, createdAt: "2024-01-01T00:00:00Z" },
            { name: "Sports", description: "Sports equipment and accessories", isActive: true, createdAt: "2024-01-01T00:00:00Z" },
            { name: "Beauty", description: "Beauty and skincare products", isActive: true, createdAt: "2024-01-01T00:00:00Z" },
        ];

        const categoryIds: Record<string, string> = {};
        for (const category of categories) {
            const id = await ctx.db.insert("categories", category);
            categoryIds[category.name] = id;
        }

        // Seed Products
        const products = [
            {
                name: "Wireless Bluetooth Headphones",
                description: "Premium noise-canceling wireless headphones with 30-hour battery life.",
                sku: "ELEC-WBH-001",
                basePrice: 149.99,
                images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop"],
                categoryId: categoryIds["Electronics"],
                isActive: true,
                stock: 150,
                variations: [
                    {
                        id: "var-001",
                        name: "Color",
                        options: [
                            { id: "opt-001", name: "Matte Black", priceModifier: 0, sku: "WBH-BLK", stock: 50 },
                            { id: "opt-002", name: "Pearl White", priceModifier: 10, sku: "WBH-WHT", stock: 50 },
                        ],
                    },
                ],
                createdAt: "2024-01-10T00:00:00Z",
            },
            {
                name: "Smart Fitness Watch",
                description: "Advanced fitness tracker with heart rate monitoring, GPS, and 7-day battery life.",
                sku: "ELEC-SFW-001",
                basePrice: 299.99,
                images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop"],
                categoryId: categoryIds["Electronics"],
                isActive: true,
                stock: 75,
                variations: [
                    {
                        id: "var-002",
                        name: "Size",
                        options: [
                            { id: "opt-004", name: "40mm", priceModifier: 0, sku: "SFW-40", stock: 40 },
                            { id: "opt-005", name: "44mm", priceModifier: 30, sku: "SFW-44", stock: 35 },
                        ],
                    },
                ],
                createdAt: "2024-01-15T00:00:00Z",
            },
            {
                name: "Premium Cotton T-Shirt",
                description: "Ultra-soft 100% organic cotton t-shirt.",
                sku: "CLTH-PCT-001",
                basePrice: 34.99,
                images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop"],
                categoryId: categoryIds["Clothing"],
                isActive: true,
                stock: 500,
                variations: [
                    {
                        id: "var-004",
                        name: "Size",
                        options: [
                            { id: "opt-008", name: "S", priceModifier: 0, sku: "PCT-S", stock: 100 },
                            { id: "opt-009", name: "M", priceModifier: 0, sku: "PCT-M", stock: 150 },
                            { id: "opt-010", name: "L", priceModifier: 0, sku: "PCT-L", stock: 150 },
                        ],
                    },
                ],
                createdAt: "2024-01-20T00:00:00Z",
            },
            {
                name: "Yoga Mat Premium",
                description: "Extra thick 6mm yoga mat with non-slip surface.",
                sku: "SPRT-YMP-001",
                basePrice: 59.99,
                images: ["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop"],
                categoryId: categoryIds["Sports"],
                isActive: true,
                stock: 120,
                variations: [
                    {
                        id: "var-007",
                        name: "Color",
                        options: [
                            { id: "opt-018", name: "Purple", priceModifier: 0, sku: "YMP-PUR", stock: 40 },
                            { id: "opt-019", name: "Teal", priceModifier: 0, sku: "YMP-TEA", stock: 40 },
                        ],
                    },
                ],
                createdAt: "2024-02-10T00:00:00Z",
            },
        ];

        for (const product of products) {
            await ctx.db.insert("products", product);
        }

        // Seed Customers
        const customers = [
            {
                name: "Acme Corporation",
                phone: "+1 (555) 300-0001",
                email: "purchasing@acme.com",
                address: "123 Business Ave, Suite 100, New York, NY 10001",
                company: "Acme Corporation",
                isActive: true,
                createdAt: "2024-01-10T00:00:00Z",
            },
            {
                name: "Global Tech Solutions",
                phone: "+1 (555) 300-0002",
                email: "orders@globaltech.com",
                address: "456 Innovation Blvd, San Francisco, CA 94102",
                company: "Global Tech Solutions",
                isActive: true,
                createdAt: "2024-01-15T00:00:00Z",
            },
            {
                name: "Metro Retail Group",
                phone: "+1 (555) 300-0003",
                email: "supply@metroretail.com",
                address: "789 Commerce St, Chicago, IL 60601",
                company: "Metro Retail Group",
                isActive: true,
                createdAt: "2024-02-01T00:00:00Z",
            },
        ];

        for (const customer of customers) {
            await ctx.db.insert("customers", customer);
        }

        return { success: true, message: "Database seeded successfully" };
    },
});
