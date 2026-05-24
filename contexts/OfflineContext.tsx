import { useState, useCallback, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useNetworkStatus } from '../lib/network-status';
import {
    getPendingOrders,
    getPendingOrderUpdates,
    removePendingOrder,
    removePendingOrderUpdate,
} from '../lib/sync-manager';
import { getCachedOrders, getCachedProducts, saveOrders, setLastSyncTimestamp, getLastSyncTimestamp } from '../lib/offline-storage';
import { createOrder, updateOrder } from '@/lib/baigo-api';
import { Order, Product } from '@/types';
import { useNotification } from './NotificationContext';

function normalizeText(value: string | undefined) {
    return (value ?? '').trim().toLowerCase();
}

function variantIdForOrderItem(item: Order['items'][number], products: Product[]): number | null {
    const product = products.find(entry => entry.id === item.productId);
    const selectedVariations = item.selectedVariations ?? [];
    const matchingCombination = product?.combinations?.find(combination => {
        if (combination.sku && combination.sku === item.productSku) return true;
        if (selectedVariations.length === 0 && combination.options.length === 0) return true;
        return combination.options.every(option =>
            selectedVariations.some(selection =>
                normalizeText(selection.variationName) === normalizeText(option.name) &&
                normalizeText(selection.optionName) === normalizeText(option.value)
            )
        );
    }) ?? product?.combinations?.[0];

    const id = Number(matchingCombination?.id ?? item.productId);
    return Number.isFinite(id) ? id : null;
}

function compactObject<T extends object>(value: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
    ) as Partial<T>;
}

function orderToApiPayload(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'>, products: Product[]) {
    const items = order.items
        .map(item => ({
            variant_id: variantIdForOrderItem(item, products),
            quantity: item.quantity,
        }))
        .filter(item => item.variant_id !== null && item.quantity > 0);

    return compactObject({
        customer_id: order.customerId ? Number(order.customerId) : undefined,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        customer_phone: order.customerPhone,
        delivery_method: 'delivery',
        ship_line1: order.customerAddress,
        ship_gps_lat: order.latitude,
        ship_gps_lng: order.longitude,
        payment_method: order.orderSource === 'client_shop' ? 'cod' : 'on_account',
        notes_customer: order.notes,
        items,
    });
}

export const [OfflineProvider, useOffline] = createContextHook(() => {
    const { isOnline, isFirstLoad } = useNetworkStatus();
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const { showToast } = useNotification();

    const refreshPendingCount = useCallback(async () => {
        const [pendingOrders, pendingUpdates] = await Promise.all([
            getPendingOrders(),
            getPendingOrderUpdates(),
        ]);
        setPendingOrdersCount(pendingOrders.length + pendingUpdates.length);
    }, []);

    const loadSyncState = useCallback(async () => {
        const lastSync = await getLastSyncTimestamp();
        setLastSyncAt(lastSync);
        await refreshPendingCount();
    }, [refreshPendingCount]);

    const syncPendingOrders = useCallback(async () => {
        if (isSyncing || !isOnline) return;

        try {
            setIsSyncing(true);
            const [pendingOrders, pendingUpdates, products, cachedOrders] = await Promise.all([
                getPendingOrders(),
                getPendingOrderUpdates(),
                getCachedProducts(),
                getCachedOrders(),
            ]);
            console.log(
                `[OfflineContext] Syncing ${pendingOrders.length} new orders and ${pendingUpdates.length} order edits...`
            );

            let syncedOrdersCount = 0;
            let syncedUpdatesCount = 0;
            const tempToRealOrderId = new Map<string, string>();
            const syncedOrders: Order[] = [];

            for (const order of pendingOrders) {
                try {
                    const payload = orderToApiPayload(order, products);
                    const createdOrder = await createOrder(payload, order.tempId);

                    await removePendingOrder(order.tempId);
                    tempToRealOrderId.set(order.tempId, createdOrder.id);
                    syncedOrders.push(createdOrder);
                    syncedOrdersCount++;
                } catch (error) {
                    console.error(`[OfflineContext] Failed to sync order ${order.tempId}:`, error);
                }
            }

            const orderLookup = [...syncedOrders, ...cachedOrders];
            for (const pendingUpdate of pendingUpdates) {
                const resolvedOrderId = tempToRealOrderId.get(pendingUpdate.orderId) ?? pendingUpdate.orderId;
                if (resolvedOrderId.startsWith('TEMP-')) {
                    console.warn(
                        `[OfflineContext] Skipping queued edit ${pendingUpdate.tempId} because order ID is still temporary`
                    );
                    continue;
                }

                const order = orderLookup.find(entry =>
                    entry.id === resolvedOrderId ||
                    entry.orderNumber === resolvedOrderId ||
                    entry.id === pendingUpdate.orderId ||
                    entry.orderNumber === pendingUpdate.orderId
                );
                if (!order?.orderNumber) {
                    console.warn(`[OfflineContext] Skipping queued edit ${pendingUpdate.tempId}; order number not found.`);
                    continue;
                }

                try {
                    await updateOrder(order.orderNumber, pendingUpdate.updates, pendingUpdate.changeDescription);
                    await removePendingOrderUpdate(pendingUpdate.tempId);
                    syncedUpdatesCount++;
                } catch (error) {
                    console.error(
                        `[OfflineContext] Failed to sync order edit ${pendingUpdate.tempId}:`,
                        error
                    );
                }
            }

            console.log(
                `[OfflineContext] Sync complete. Orders: ${syncedOrdersCount}/${pendingOrders.length}, edits: ${syncedUpdatesCount}/${pendingUpdates.length}.`
            );

            if (syncedOrders.length > 0) {
                const merged = new Map(cachedOrders.map(order => [order.id, order]));
                syncedOrders.forEach(order => merged.set(order.id, order));
                await saveOrders(Array.from(merged.values()));
            }

            if (syncedOrdersCount > 0 || syncedUpdatesCount > 0) {
                const now = new Date().toISOString();
                await setLastSyncTimestamp(now);
                setLastSyncAt(now);
                const syncedParts: string[] = [];
                if (syncedOrdersCount > 0) syncedParts.push(`${syncedOrdersCount} new orders`);
                if (syncedUpdatesCount > 0) syncedParts.push(`${syncedUpdatesCount} edited orders`);
                showToast(`Synced ${syncedParts.join(' and ')}`, 'success');
            }

            await refreshPendingCount();
        } catch (error) {
            console.error('[OfflineContext] Sync error:', error);
            showToast('Sync failed. Will retry later.', 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, isSyncing, refreshPendingCount, showToast]);

    useEffect(() => {
        loadSyncState();
    }, [loadSyncState]);

    useEffect(() => {
        refreshPendingCount();
    }, [isOnline, refreshPendingCount]);

    useEffect(() => {
        if (isOnline && pendingOrdersCount > 0) {
            console.log('[OfflineContext] Connection restored. Auto-syncing pending orders...');
            syncPendingOrders();
        }
    }, [isOnline, pendingOrdersCount, syncPendingOrders]);

    return {
        isOnline,
        isFirstLoad,
        isOfflineMode: !isOnline,
        pendingOrdersCount,
        lastSyncAt,
        isSyncing,
        refreshPendingCount,
        syncPendingOrders,
    };
});
