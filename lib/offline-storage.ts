import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Product, Category, Customer, Order } from '@/types';

const CACHE_DIR = `${FileSystem.documentDirectory}offline-cache`;
const USE_FILE_CACHE = Platform.OS !== 'web';

const FILE_NAMES = {
    PRODUCTS: 'products.json',
    CATEGORIES: 'categories.json',
    CUSTOMERS: 'customers.json',
    ORDERS: 'orders.json',
} as const;

const LEGACY_STORAGE_KEYS = {
    PRODUCTS: '@salesapp_offline_products',
    CATEGORIES: '@salesapp_offline_categories',
    CUSTOMERS: '@salesapp_offline_customers',
    ORDERS: '@salesapp_offline_orders',
};

const STORAGE_KEYS = {
    LAST_SYNC: '@salesapp_last_sync',
    CUSTOMER_SYNC_VERSION: '@salesapp_customer_sync_version',
    PRODUCTS: '@salesapp_file_cache_products',
    CATEGORIES: '@salesapp_file_cache_categories',
    CUSTOMERS: '@salesapp_file_cache_customers',
    ORDERS: '@salesapp_file_cache_orders',
};

const WEB_STORAGE_KEYS: Record<string, string> = {
    [FILE_NAMES.PRODUCTS]: STORAGE_KEYS.PRODUCTS,
    [FILE_NAMES.CATEGORIES]: STORAGE_KEYS.CATEGORIES,
    [FILE_NAMES.CUSTOMERS]: STORAGE_KEYS.CUSTOMERS,
    [FILE_NAMES.ORDERS]: STORAGE_KEYS.ORDERS,
};

function getFileUri(fileName: string): string {
    return `${CACHE_DIR}/${fileName}`;
}

async function ensureCacheDir(): Promise<void> {
    try {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    } catch {
        // Directory may already exist; safe to ignore.
    }
}

async function saveToFile<T>(fileName: string, data: T): Promise<void> {
    try {
        if (!USE_FILE_CACHE) {
            await AsyncStorage.setItem(WEB_STORAGE_KEYS[fileName], JSON.stringify(data));
            return;
        }

        await ensureCacheDir();
        await FileSystem.writeAsStringAsync(
            getFileUri(fileName),
            JSON.stringify(data),
            { encoding: 'utf8' }
        );
    } catch (error) {
        console.error(`[OfflineStorage] Error writing ${fileName}:`, error);
    }
}

async function getFromFile<T>(fileName: string): Promise<T | null> {
    try {
        if (!USE_FILE_CACHE) {
            const raw = await AsyncStorage.getItem(WEB_STORAGE_KEYS[fileName]);
            return raw ? (JSON.parse(raw) as T) : null;
        }

        const fileUri = getFileUri(fileName);
        const info = await FileSystem.getInfoAsync(fileUri);
        if (!info.exists) return null;

        const content = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
        return content ? (JSON.parse(content) as T) : null;
    } catch (error) {
        console.error(`[OfflineStorage] Error reading ${fileName}:`, error);
        return null;
    }
}

async function migrateLegacyData<T>(legacyKey: string, fileName: string): Promise<T | null> {
    try {
        const legacyRaw = await AsyncStorage.getItem(legacyKey);
        if (!legacyRaw) return null;

        const parsed = JSON.parse(legacyRaw) as T;
        await saveToFile(fileName, parsed);
        await AsyncStorage.removeItem(legacyKey);
        console.log(`[OfflineStorage] Migrated ${legacyKey} to file cache`);
        return parsed;
    } catch (error) {
        console.error(`[OfflineStorage] Error migrating ${legacyKey}:`, error);
        return null;
    }
}

async function getCachedData<T>(legacyKey: string, fileName: string): Promise<T | null> {
    const fileData = await getFromFile<T>(fileName);
    if (fileData !== null) return fileData;
    return migrateLegacyData<T>(legacyKey, fileName);
}

// Product caching
export const saveProducts = async (products: Product[]) => {
    console.log(`[OfflineStorage] Caching ${products.length} products`);
    await saveToFile(FILE_NAMES.PRODUCTS, products);
};

export const getCachedProducts = async (): Promise<Product[]> => {
    return (await getCachedData<Product[]>(LEGACY_STORAGE_KEYS.PRODUCTS, FILE_NAMES.PRODUCTS)) || [];
};

// Category caching
export const saveCategories = async (categories: Category[]) => {
    console.log(`[OfflineStorage] Caching ${categories.length} categories`);
    await saveToFile(FILE_NAMES.CATEGORIES, categories);
};

export const getCachedCategories = async (): Promise<Category[]> => {
    return (await getCachedData<Category[]>(LEGACY_STORAGE_KEYS.CATEGORIES, FILE_NAMES.CATEGORIES)) || [];
};

// Customer caching
export const saveCustomers = async (customers: Customer[]) => {
    console.log(`[OfflineStorage] Caching ${customers.length} customers`);
    await saveToFile(FILE_NAMES.CUSTOMERS, customers);
};

export const getCachedCustomers = async (): Promise<Customer[]> => {
    return (await getCachedData<Customer[]>(LEGACY_STORAGE_KEYS.CUSTOMERS, FILE_NAMES.CUSTOMERS)) || [];
};

// Order history caching
export const saveOrders = async (orders: Order[]) => {
    console.log(`[OfflineStorage] Caching ${orders.length} orders`);
    await saveToFile(FILE_NAMES.ORDERS, orders);
};

export const getCachedOrders = async (): Promise<Order[]> => {
    return (await getCachedData<Order[]>(LEGACY_STORAGE_KEYS.ORDERS, FILE_NAMES.ORDERS)) || [];
};

// Sync timestamp
export const setLastSyncTimestamp = async (timestamp: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
};

export const getLastSyncTimestamp = async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
};

export const setCustomerSyncVersion = async (version: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMER_SYNC_VERSION, version);
};

export const getCustomerSyncVersion = async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMER_SYNC_VERSION);
};

// Clear all cache (useful for debugging or logout)
export const clearAllCache = async () => {
    try {
        if (USE_FILE_CACHE) {
            await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
        }

        await AsyncStorage.multiRemove([
            STORAGE_KEYS.LAST_SYNC,
            STORAGE_KEYS.CUSTOMER_SYNC_VERSION,
            STORAGE_KEYS.PRODUCTS,
            STORAGE_KEYS.CATEGORIES,
            STORAGE_KEYS.CUSTOMERS,
            STORAGE_KEYS.ORDERS,
            LEGACY_STORAGE_KEYS.PRODUCTS,
            LEGACY_STORAGE_KEYS.CATEGORIES,
            LEGACY_STORAGE_KEYS.CUSTOMERS,
            LEGACY_STORAGE_KEYS.ORDERS,
        ]);
        console.log('[OfflineStorage] Cache cleared');
    } catch (error) {
        console.error('[OfflineStorage] Error clearing cache:', error);
    }
};
