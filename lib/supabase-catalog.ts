import { Category, Product, ProductCombination, ProductVariation, VariationOption } from '@/types';
import { getSupabaseClient } from '@/lib/supabase';

type JsonRecord = Record<string, unknown>;

export type SupabaseCatalogSnapshot = {
  products: Product[];
  categories: Category[];
};

const DEFAULT_PRODUCTS_VIEW = 'mobile_catalog_products';
const DEFAULT_CATEGORIES_VIEW = 'mobile_catalog_categories';
const DEFAULT_LIMIT = 5000;

function pick(row: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }

  return undefined;
}

function stringValue(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function optionalString(value: unknown): string | undefined {
  const resolved = stringValue(value).trim();
  return resolved ? resolved : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = numberValue(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'inactive'].includes(normalized)) return false;
  }

  return fallback;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function stringArray(value: unknown, fallbackSingle?: unknown): string[] {
  const parsed = parseJsonArray<unknown>(value)
    .map((item) => optionalString(item))
    .filter((item): item is string => !!item);

  if (parsed.length > 0) return parsed;

  const single = optionalString(fallbackSingle);
  return single ? [single] : [];
}

function mapVariationOption(row: JsonRecord, index: number): VariationOption {
  return {
    id: stringValue(pick(row, 'id', 'option_id'), `option-${index}`),
    name: stringValue(pick(row, 'name', 'option_name', 'value'), `Option ${index + 1}`),
    priceModifier: numberValue(pick(row, 'priceModifier', 'price_modifier'), 0),
    sku: stringValue(pick(row, 'sku', 'option_sku')),
    stock: numberValue(pick(row, 'stock', 'quantity'), 0),
    image: optionalString(pick(row, 'image', 'image_url')),
    moq: optionalNumber(pick(row, 'moq', 'min_order_quantity', 'minPurchaseQuantity')),
  };
}

function mapVariations(value: unknown): ProductVariation[] {
  return parseJsonArray<JsonRecord>(value)
    .map((row, index) => ({
      id: stringValue(pick(row, 'id', 'variation_id'), `variation-${index}`),
      name: stringValue(pick(row, 'name', 'variation_name'), `Variation ${index + 1}`),
      options: parseJsonArray<JsonRecord>(pick(row, 'options'))
        .map((option, optionIndex) => mapVariationOption(option, optionIndex)),
    }))
    .filter((variation) => variation.options.length > 0);
}

function mapCombinations(value: unknown): ProductCombination[] | undefined {
  const combinations = parseJsonArray<JsonRecord>(value)
    .map((row, index) => ({
      id: stringValue(pick(row, 'id', 'combination_id'), `combination-${index}`),
      options: parseJsonArray<JsonRecord>(pick(row, 'options')).map((option) => ({
        name: stringValue(pick(option, 'name', 'variation_name')),
        value: stringValue(pick(option, 'value', 'option_name')),
      })),
      price: numberValue(pick(row, 'price', 'base_price'), 0),
      sku: optionalString(pick(row, 'sku')),
      stock: optionalNumber(pick(row, 'stock', 'quantity')),
    }))
    .filter((combination) => combination.options.length > 0);

  return combinations.length > 0 ? combinations : undefined;
}

function mapSupabaseCategory(row: JsonRecord): Category {
  const id = stringValue(pick(row, 'id', 'category_id', 'external_id', 'ecwid_id'));

  return {
    id,
    name: stringValue(pick(row, 'name'), 'Uncategorized'),
    description: stringValue(pick(row, 'description')),
    image: optionalString(pick(row, 'image', 'image_url')),
    parentId: optionalString(pick(row, 'parentId', 'parent_id')),
    isActive: booleanValue(pick(row, 'isActive', 'is_active', 'enabled'), true),
    createdAt: stringValue(pick(row, 'createdAt', 'created_at'), new Date().toISOString()),
    ecwidId: optionalNumber(pick(row, 'ecwidId', 'ecwid_id')),
  };
}

function mapSupabaseProduct(row: JsonRecord): Product {
  const sku = stringValue(pick(row, 'sku'), 'NO-SKU');
  const id = stringValue(pick(row, 'id', 'product_id', 'external_id', 'ecwid_id'), sku);

  return {
    id,
    name: stringValue(pick(row, 'name'), 'Unnamed Product'),
    description: stringValue(pick(row, 'description')),
    sku,
    basePrice: numberValue(pick(row, 'basePrice', 'base_price', 'price'), 0),
    compareAtPrice: optionalNumber(pick(row, 'compareAtPrice', 'compare_at_price')),
    images: stringArray(pick(row, 'images', 'image_urls', 'gallery_images'), pick(row, 'image', 'image_url')),
    categoryId: stringValue(pick(row, 'categoryId', 'category_id'), 'uncategorized'),
    isActive: booleanValue(pick(row, 'isActive', 'is_active', 'enabled'), true),
    variations: mapVariations(pick(row, 'variations', 'options')),
    combinations: mapCombinations(pick(row, 'combinations')),
    stock: numberValue(pick(row, 'stock', 'quantity'), 0),
    createdAt: stringValue(pick(row, 'createdAt', 'created_at'), new Date().toISOString()),
    moq: optionalNumber(pick(row, 'moq', 'min_order_quantity', 'minPurchaseQuantity')),
    ecwidId: optionalNumber(pick(row, 'ecwidId', 'ecwid_id')),
    ribbon: optionalString(pick(row, 'ribbon', 'ribbon_text')),
    ribbonColor: optionalString(pick(row, 'ribbonColor', 'ribbon_color')),
  };
}

async function fetchRows(tableName: string, limit: number): Promise<JsonRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from(tableName)
    .select('*')
    .limit(limit);

  if (error) {
    throw new Error(`[Supabase] Failed to fetch ${tableName}: ${error.message}`);
  }

  return (data ?? []) as JsonRecord[];
}

export async function fetchSupabaseCatalogSnapshot(): Promise<SupabaseCatalogSnapshot> {
  const productsView = process.env.EXPO_PUBLIC_SUPABASE_PRODUCTS_VIEW || DEFAULT_PRODUCTS_VIEW;
  const categoriesView = process.env.EXPO_PUBLIC_SUPABASE_CATEGORIES_VIEW || DEFAULT_CATEGORIES_VIEW;
  const limit = numberValue(process.env.EXPO_PUBLIC_SUPABASE_CATALOG_LIMIT, DEFAULT_LIMIT);

  const [productRows, categoryRows] = await Promise.all([
    fetchRows(productsView, limit),
    fetchRows(categoriesView, limit),
  ]);

  return {
    products: productRows.map(mapSupabaseProduct),
    categories: categoryRows.map(mapSupabaseCategory),
  };
}
