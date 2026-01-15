import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';

const PENDING_ORDERS_KEY = '@salesapp_pending_orders';

export interface PendingOrder extends Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'> {
    tempId: string;
    createdAt: string;
}

// Queue an order for sync
export const queueOrder = async (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => {
    try {
        const currentQueue = await getPendingOrders();

        // Create a temporary local order
        const tempId = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newPendingOrder: PendingOrder = {
            ...orderData,
            tempId,
            createdAt: new Date().toISOString(),
        };

        const updatedQueue = [...currentQueue, newPendingOrder];
        await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedQueue));

        console.log(`[SyncManager] Order queued. Total pending: ${updatedQueue.length}`);
        return newPendingOrder;
    } catch (error) {
        console.error('[SyncManager] Error queuing order:', error);
        throw error;
    }
};

// Get all pending orders
export const getPendingOrders = async (): Promise<PendingOrder[]> => {
    try {
        const data = await AsyncStorage.getItem(PENDING_ORDERS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('[SyncManager] Error getting pending orders:', error);
        return [];
    }
};

// Remove a pending order (after successful sync)
export const removePendingOrder = async (tempId: string) => {
    try {
        const currentQueue = await getPendingOrders();
        const updatedQueue = currentQueue.filter(item => item.tempId !== tempId);
        await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedQueue));
        console.log(`[SyncManager] Order removed from queue. Remaining: ${updatedQueue.length}`);
    } catch (error) {
        console.error('[SyncManager] Error removing pending order:', error);
    }
};

// Clear entire queue
export const clearSyncQueue = async () => {
    try {
        await AsyncStorage.removeItem(PENDING_ORDERS_KEY);
        console.log('[SyncManager] Sync queue cleared');
    } catch (error) {
        console.error('[SyncManager] Error clearing sync queue:', error);
    }
};
