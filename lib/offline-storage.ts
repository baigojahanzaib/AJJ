import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Category, Customer, Order } from '@/types';

// Storage keys
const STORAGE_KEYS = {
    PRODUCTS: '@salesapp_offline_products',
    CATEGORIES: '@salesapp_offline_categories',
    CUSTOMERS: '@salesapp_offline_customers',
    ORDERS: '@salesapp_offline_orders', // For viewing history
    LAST_SYNC: '@salesapp_last_sync',
};

// Generic storage helpers
async function saveData<T>(key: string, data: T): Promise<void> {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`[OfflineStorage] Error saving data for key ${key}:`, error);
    }
}

async function getData<T>(key: string): Promise<T | null> {
    try {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`[OfflineStorage] Error retrieving data for key ${key}:`, error);
        return null;
    }
}

// Product caching
export const saveProducts = async (products: Product[]) => {
    console.log(`[OfflineStorage] Caching ${products.length} products`);
    await saveData(STORAGE_KEYS.PRODUCTS, products);
};

export const getCachedProducts = async (): Promise<Product[]> => {
    return (await getData<Product[]>(STORAGE_KEYS.PRODUCTS)) || [];
};

// Category caching
export const saveCategories = async (categories: Category[]) => {
    console.log(`[OfflineStorage] Caching ${categories.length} categories`);
    await saveData(STORAGE_KEYS.CATEGORIES, categories);
};

export const getCachedCategories = async (): Promise<Category[]> => {
    return (await getData<Category[]>(STORAGE_KEYS.CATEGORIES)) || [];
};

// Customer caching
export const saveCustomers = async (customers: Customer[]) => {
    console.log(`[OfflineStorage] Caching ${customers.length} customers`);
    await saveData(STORAGE_KEYS.CUSTOMERS, customers);
};

export const getCachedCustomers = async (): Promise<Customer[]> => {
    return (await getData<Customer[]>(STORAGE_KEYS.CUSTOMERS)) || [];
};

// Order history caching
export const saveOrders = async (orders: Order[]) => {
    console.log(`[OfflineStorage] Caching ${orders.length} orders`);
    await saveData(STORAGE_KEYS.ORDERS, orders);
};

export const getCachedOrders = async (): Promise<Order[]> => {
    return (await getData<Order[]>(STORAGE_KEYS.ORDERS)) || [];
};

// Sync timestamp
export const setLastSyncTimestamp = async (timestamp: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp);
};

export const getLastSyncTimestamp = async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
};

// Clear all cache (useful for debugging or logout)
export const clearAllCache = async () => {
    try {
        const keys = Object.values(STORAGE_KEYS);
        await AsyncStorage.multiRemove(keys);
        console.log('[OfflineStorage] Cache cleared');
    } catch (error) {
        console.error('[OfflineStorage] Error clearing cache:', error);
    }
};
