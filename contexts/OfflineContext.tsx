import { useState, useCallback, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useNetworkStatus } from '../lib/network-status';
import {
    getPendingOrders,
    getPendingOrderUpdates,
    removePendingOrder,
    removePendingOrderUpdate,
} from '../lib/sync-manager';
import { setLastSyncTimestamp, getLastSyncTimestamp } from '../lib/offline-storage';
import { api } from '../convex/_generated/api';
import { useMutation } from 'convex/react';

import { useNotification } from './NotificationContext';

export const [OfflineProvider, useOffline] = createContextHook(() => {
    const { isOnline, isFirstLoad } = useNetworkStatus();
    const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const { showToast } = useNotification();

    // Convex mutations for syncing
    const createOrderMutation = useMutation(api.orders.create);
    const updateOrderMutation = useMutation(api.orders.update);

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
            const [pendingOrders, pendingUpdates] = await Promise.all([
                getPendingOrders(),
                getPendingOrderUpdates(),
            ]);
            console.log(
                `[OfflineContext] Syncing ${pendingOrders.length} new orders and ${pendingUpdates.length} order edits...`
            );

            let syncedOrdersCount = 0;
            let syncedUpdatesCount = 0;
            const tempToRealOrderId = new Map<string, string>();

            for (const order of pendingOrders) {
                try {
                    const createdOrderId = await createOrderMutation({
                        salesRepId: order.salesRepId,
                        salesRepName: order.salesRepName,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        customerEmail: order.customerEmail,
                        customerAddress: order.customerAddress,
                        items: order.items,
                        subtotal: order.subtotal,
                        tax: order.tax,
                        discount: order.discount,
                        total: order.total,
                        status: order.status,
                        notes: order.notes,
                    });

                    // Remove from queue after successful sync
                    await removePendingOrder(order.tempId);
                    tempToRealOrderId.set(order.tempId, String(createdOrderId));
                    syncedOrdersCount++;
                } catch (error) {
                    console.error(`[OfflineContext] Failed to sync order ${order.tempId}:`, error);
                    // Keep in queue to retry later
                }
            }

            for (const pendingUpdate of pendingUpdates) {
                const resolvedOrderId = tempToRealOrderId.get(pendingUpdate.orderId) ?? pendingUpdate.orderId;
                if (resolvedOrderId.startsWith('TEMP-')) {
                    console.warn(
                        `[OfflineContext] Skipping queued edit ${pendingUpdate.tempId} because order ID is still temporary`
                    );
                    continue;
                }

                try {
                    await updateOrderMutation({
                        id: resolvedOrderId as any,
                        editedBy: pendingUpdate.editedBy,
                        editedByName: pendingUpdate.editedByName,
                        changeDescription: pendingUpdate.changeDescription,
                        ...pendingUpdate.updates,
                    } as any);
                    await removePendingOrderUpdate(pendingUpdate.tempId);
                    syncedUpdatesCount++;
                } catch (error) {
                    console.error(
                        `[OfflineContext] Failed to sync order edit ${pendingUpdate.tempId}:`,
                        error
                    );
                    // Keep in queue to retry later
                }
            }

            console.log(
                `[OfflineContext] Sync complete. Orders: ${syncedOrdersCount}/${pendingOrders.length}, edits: ${syncedUpdatesCount}/${pendingUpdates.length}.`
            );

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
    }, [isOnline, isSyncing, createOrderMutation, refreshPendingCount, showToast, updateOrderMutation]);

    // Load initial state
    useEffect(() => {
        loadSyncState();
    }, [loadSyncState]);

    // Update pending count whenever online status changes or manually triggered
    useEffect(() => {
        refreshPendingCount();
    }, [isOnline, refreshPendingCount]);

    // Auto-sync when coming back online
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
