import { useState, useCallback, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useNetworkStatus } from '../lib/network-status';
import { getPendingOrders, PendingOrder, removePendingOrder } from '../lib/sync-manager';
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

    // Load initial state
    useEffect(() => {
        loadSyncState();
    }, []);

    // Update pending count whenever online status changes or manually triggered
    useEffect(() => {
        refreshPendingCount();
    }, [isOnline]);

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline && pendingOrdersCount > 0) {
            console.log('[OfflineContext] Connection restored. Auto-syncing pending orders...');
            syncPendingOrders();
        }
    }, [isOnline, pendingOrdersCount]);

    const loadSyncState = async () => {
        const lastSync = await getLastSyncTimestamp();
        setLastSyncAt(lastSync);
        await refreshPendingCount();
    };

    const refreshPendingCount = async () => {
        const pending = await getPendingOrders();
        setPendingOrdersCount(pending.length);
    };

    const syncPendingOrders = useCallback(async () => {
        if (isSyncing || !isOnline) return;

        try {
            setIsSyncing(true);
            const pendingOrders = await getPendingOrders();
            console.log(`[OfflineContext] Syncing ${pendingOrders.length} orders...`);

            let syncedCount = 0;

            for (const order of pendingOrders) {
                try {
                    await createOrderMutation({
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
                    syncedCount++;
                } catch (error) {
                    console.error(`[OfflineContext] Failed to sync order ${order.tempId}:`, error);
                    // Keep in queue to retry later
                }
            }

            console.log(`[OfflineContext] Sync complete. ${syncedCount}/${pendingOrders.length} orders synced.`);

            if (syncedCount > 0) {
                const now = new Date().toISOString();
                await setLastSyncTimestamp(now);
                setLastSyncAt(now);
                showToast(`Synced ${syncedCount} offline orders`, 'success');
            }

            await refreshPendingCount();
        } catch (error) {
            console.error('[OfflineContext] Sync error:', error);
            showToast('Sync failed. Will retry later.', 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, isSyncing, createOrderMutation]);

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
