import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '@/types';

const PENDING_ORDERS_KEY = '@salesapp_pending_orders';
const PENDING_ORDER_UPDATES_KEY = '@salesapp_pending_order_updates';

export interface PendingOrder extends Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'> {
    tempId: string;
    createdAt: string;
}

export interface PendingOrderUpdate {
    tempId: string;
    orderId: string;
    updates: Partial<Order>;
    editedBy: string;
    editedByName: string;
    changeDescription: string;
    queuedAt: string;
}

const ORDER_UPDATE_ALLOWED_KEYS: (keyof Order)[] = [
    'customerName',
    'customerPhone',
    'customerEmail',
    'customerAddress',
    'latitude',
    'longitude',
    'items',
    'subtotal',
    'tax',
    'discount',
    'total',
    'notes',
    'status',
];

function sanitizeOrderUpdateFields(updates: Partial<Order>): Partial<Order> {
    const result: Partial<Order> = {};
    for (const key of ORDER_UPDATE_ALLOWED_KEYS) {
        const value = updates[key];
        if (value !== undefined) {
            (result as Record<string, unknown>)[key] = value;
        }
    }
    return result;
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

export const updatePendingOrder = async (tempId: string, updates: Partial<PendingOrder>) => {
    try {
        const currentQueue = await getPendingOrders();
        const updatedQueue = currentQueue.map(item =>
            item.tempId === tempId ? { ...item, ...updates } : item
        );
        await AsyncStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(updatedQueue));
        return updatedQueue.find(item => item.tempId === tempId) || null;
    } catch (error) {
        console.error('[SyncManager] Error updating pending order:', error);
        return null;
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

export const getPendingOrderUpdates = async (): Promise<PendingOrderUpdate[]> => {
    try {
        const data = await AsyncStorage.getItem(PENDING_ORDER_UPDATES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('[SyncManager] Error getting pending order updates:', error);
        return [];
    }
};

export const queueOrderUpdate = async (payload: {
    orderId: string;
    updates: Partial<Order>;
    editedBy: string;
    editedByName: string;
    changeDescription: string;
}) => {
    try {
        const currentQueue = await getPendingOrderUpdates();
        const safeUpdates = sanitizeOrderUpdateFields(payload.updates);

        const existingIndex = currentQueue.findIndex(item => item.orderId === payload.orderId);
        const now = new Date().toISOString();

        if (existingIndex >= 0) {
            const updatedQueue = [...currentQueue];
            const existing = updatedQueue[existingIndex];
            updatedQueue[existingIndex] = {
                ...existing,
                updates: {
                    ...existing.updates,
                    ...safeUpdates,
                },
                editedBy: payload.editedBy,
                editedByName: payload.editedByName,
                changeDescription: payload.changeDescription,
                queuedAt: now,
            };
            await AsyncStorage.setItem(PENDING_ORDER_UPDATES_KEY, JSON.stringify(updatedQueue));
            console.log(`[SyncManager] Updated queued edit for order ${payload.orderId}`);
            return updatedQueue[existingIndex];
        }

        const newUpdate: PendingOrderUpdate = {
            tempId: `UPD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            orderId: payload.orderId,
            updates: safeUpdates,
            editedBy: payload.editedBy,
            editedByName: payload.editedByName,
            changeDescription: payload.changeDescription,
            queuedAt: now,
        };

        const updatedQueue = [...currentQueue, newUpdate];
        await AsyncStorage.setItem(PENDING_ORDER_UPDATES_KEY, JSON.stringify(updatedQueue));
        console.log(`[SyncManager] Order update queued. Total pending edits: ${updatedQueue.length}`);
        return newUpdate;
    } catch (error) {
        console.error('[SyncManager] Error queuing order update:', error);
        throw error;
    }
};

export const removePendingOrderUpdate = async (tempId: string) => {
    try {
        const currentQueue = await getPendingOrderUpdates();
        const updatedQueue = currentQueue.filter(item => item.tempId !== tempId);
        await AsyncStorage.setItem(PENDING_ORDER_UPDATES_KEY, JSON.stringify(updatedQueue));
        console.log(`[SyncManager] Order update removed from queue. Remaining edits: ${updatedQueue.length}`);
    } catch (error) {
        console.error('[SyncManager] Error removing pending order update:', error);
    }
};

// Clear entire queue
export const clearSyncQueue = async () => {
    try {
        await AsyncStorage.multiRemove([PENDING_ORDERS_KEY, PENDING_ORDER_UPDATES_KEY]);
        console.log('[SyncManager] Sync queue cleared');
    } catch (error) {
        console.error('[SyncManager] Error clearing sync queue:', error);
    }
};
