/**
 * Ecwid API Client
 * 
 * TypeScript client for interacting with the Ecwid REST API.
 * Handles fetching products, categories, and variations.
 */

// Ecwid API Types
export interface EcwidCategory {
    id: number;
    name: string;
    description?: string;
    imageUrl?: string;
    parentId?: number;
    enabled: boolean;
    productCount?: number;
}

export interface EcwidProductOption {
    name: string;
    choices: Array<{
        text: string;
        priceModifier: number;
        priceModifierType: "ABSOLUTE" | "PERCENT";
    }>;
}

export interface EcwidProductVariation {
    id: number;
    sku?: string;
    price?: number;
    quantity?: number;
    options: Array<{
        name: string;
        value: string;
    }>;
    imageUrl?: string;
}

export interface EcwidProduct {
    id: number;
    name: string;
    description?: string;
    sku?: string;
    price: number;
    compareToPrice?: number;
    quantity?: number;
    categoryIds?: number[];
    imageUrl?: string;
    galleryImages?: Array<{ url: string }>;
    enabled: boolean;
    options?: EcwidProductOption[];
    variations?: EcwidProductVariation[];
    // Ribbon/promotion label (Ecwid returns as object)
    ribbon?: {
        text: string;
        color: string;
    };
}

export interface EcwidCategoriesResponse {
    total: number;
    count: number;
    offset: number;
    limit: number;
    items: EcwidCategory[];
}

export interface EcwidProductsResponse {
    total: number;
    count: number;
    offset: number;
    limit: number;
    items: EcwidProduct[];
}

// Types matching Convex schema
export interface ConvexCategory {
    name: string;
    description: string;
    image?: string;
    parentId?: string;
    isActive: boolean;
    createdAt: string;
    ecwidId: number;
}

export interface ConvexVariationOption {
    id: string;
    name: string;
    priceModifier: number;
    sku: string;
    stock: number;
    image?: string;
}

export interface ConvexProductVariation {
    id: string;
    name: string;
    options: ConvexVariationOption[];
}

export interface ConvexProduct {
    name: string;
    description: string;
    sku: string;
    basePrice: number;
    images: string[];
    categoryId: string;
    isActive: boolean;
    variations: ConvexProductVariation[];
    stock: number;
    createdAt: string;
    ecwidId: number;
    // Ribbon/promotion tag
    ribbon?: string;
    ribbonColor?: string;
}

const ECWID_API_BASE = "https://app.ecwid.com/api/v3";

/**
 * Fetch all categories from Ecwid store
 */
export async function fetchEcwidCategories(
    storeId: string,
    accessToken: string
): Promise<EcwidCategory[]> {
    const allCategories: EcwidCategory[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const url = `${ECWID_API_BASE}/${storeId}/categories?offset=${offset}&limit=${limit}`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ecwid API error (categories): ${response.status} - ${errorText}`);
        }

        const data: EcwidCategoriesResponse = await response.json();
        allCategories.push(...data.items);

        if (offset + data.count >= data.total) {
            break;
        }
        offset += limit;
    }

    return allCategories;
}

/**
 * Fetch all products from Ecwid store (including variations)
 */
export async function fetchEcwidProducts(
    storeId: string,
    accessToken: string
): Promise<EcwidProduct[]> {
    const allProducts: EcwidProduct[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const url = `${ECWID_API_BASE}/${storeId}/products?offset=${offset}&limit=${limit}&includeProductVariations=true`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ecwid API error (products): ${response.status} - ${errorText}`);
        }

        const data: EcwidProductsResponse = await response.json();
        allProducts.push(...data.items);

        if (offset + data.count >= data.total) {
            break;
        }
        offset += limit;
    }

    return allProducts;
}

/**
 * Map Ecwid category to Convex schema format
 */
export function mapEcwidCategoryToConvex(
    ecwidCategory: EcwidCategory,
    ecwidIdToCategoryIdMap: Map<number, string>
): ConvexCategory {
    return {
        name: ecwidCategory.name || "Unnamed Category",
        description: ecwidCategory.description || "",
        image: ecwidCategory.imageUrl,
        parentId: ecwidCategory.parentId
            ? ecwidIdToCategoryIdMap.get(ecwidCategory.parentId)
            : undefined,
        isActive: ecwidCategory.enabled,
        createdAt: new Date().toISOString(),
        ecwidId: ecwidCategory.id,
    };
}

/**
 * Map Ecwid product to Convex schema format
 */
export function mapEcwidProductToConvex(
    ecwidProduct: EcwidProduct,
    categoryId: string
): ConvexProduct {
    // Build images array
    const images: string[] = [];
    if (ecwidProduct.imageUrl) {
        images.push(ecwidProduct.imageUrl);
    }
    if (ecwidProduct.galleryImages) {
        images.push(...ecwidProduct.galleryImages.map(img => img.url));
    }

    // Build variations from Ecwid options and variations
    const variations: ConvexProductVariation[] = [];

    if (ecwidProduct.options && ecwidProduct.options.length > 0) {
        // Convert Ecwid options to our variation format
        for (const option of ecwidProduct.options) {
            const convexVariation: ConvexProductVariation = {
                id: `opt-${option.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: option.name,
                options: option.choices.map((choice, index) => {
                    // Calculate price modifier
                    let priceModifier = choice.priceModifier || 0;
                    if (choice.priceModifierType === "PERCENT") {
                        priceModifier = (ecwidProduct.price * priceModifier) / 100;
                    }

                    return {
                        id: `${option.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
                        name: choice.text,
                        priceModifier,
                        sku: ecwidProduct.sku ? `${ecwidProduct.sku}-${choice.text}` : `SKU-${index}`,
                        stock: ecwidProduct.quantity || 0,
                        image: undefined,
                    };
                }),
            };
            variations.push(convexVariation);
        }
    }

    // If product has variations (combinations), add additional info
    if (ecwidProduct.variations && ecwidProduct.variations.length > 0) {
        // Update stock and SKU from specific variations
        for (const ecwidVar of ecwidProduct.variations) {
            for (const optionValue of ecwidVar.options) {
                const variation = variations.find(v => v.name === optionValue.name);
                if (variation) {
                    const option = variation.options.find(o => o.name === optionValue.value);
                    if (option) {
                        if (ecwidVar.sku) option.sku = ecwidVar.sku;
                        if (ecwidVar.quantity !== undefined) option.stock = ecwidVar.quantity;
                        if (ecwidVar.imageUrl) option.image = ecwidVar.imageUrl;
                        if (ecwidVar.price !== undefined) {
                            option.priceModifier = ecwidVar.price - ecwidProduct.price;
                        }
                    }
                }
            }
        }
    }

    return {
        name: ecwidProduct.name || "Unnamed Product",
        description: stripHtml(ecwidProduct.description || ""),
        sku: ecwidProduct.sku || `ECWID-${ecwidProduct.id}`,
        basePrice: ecwidProduct.price || 0,
        images: images.length > 0 ? images : ["https://via.placeholder.com/300"],
        categoryId,
        isActive: ecwidProduct.enabled,
        variations,
        stock: ecwidProduct.quantity || 0,
        createdAt: new Date().toISOString(),
        ecwidId: ecwidProduct.id,
        // Ribbon/promotion tag from Ecwid (ribbon is an object with text and color)
        ribbon: ecwidProduct.ribbon?.text,
        ribbonColor: ecwidProduct.ribbon?.color,
    };
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Test connection to Ecwid API
 */
export async function testEcwidConnection(
    storeId: string,
    accessToken: string
): Promise<{ success: boolean; message: string }> {
    try {
        const url = `${ECWID_API_BASE}/${storeId}/profile`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return {
                success: false,
                message: `Connection failed: ${response.status} - ${response.statusText}`
            };
        }

        return { success: true, message: "Successfully connected to Ecwid store" };
    } catch (error) {
        return {
            success: false,
            message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}
