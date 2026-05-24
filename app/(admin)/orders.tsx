import { useState, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckSquare, Download, FileSpreadsheet, PackageSearch, Square, Trash2, X } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useData } from '@/contexts/DataContext';
import * as Haptics from 'expo-haptics';
import SearchBar from '@/components/SearchBar';
import OrderCard from '@/components/OrderCard';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';
import { OrderStatus } from '@/types';
import { generateAndShareProcurementCsv, ProcurementExportMode } from '@/lib/procurement-export';
import { ORDER_STATUS_FILTERS } from '@/lib/order-status';

const statusFilters: { id: OrderStatus | 'all'; label: string }[] = ORDER_STATUS_FILTERS;

export default function AdminOrders() {
  const router = useRouter();
  const { orders, products, updateOrderStatus, deleteOrder } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.salesRepName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const sortedOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const selectedOrders = useMemo(() => {
    const selectedIds = new Set(selectedOrderIds);
    return orders.filter(order => selectedIds.has(order.id));
  }, [orders, selectedOrderIds]);

  const handleOrderPress = (orderId: string) => {
    if (isSelectionMode) {
      toggleOrderSelection(orderId);
      return;
    }

    try {
      console.log('[AdminOrders] Navigating to order:', orderId);
      router.push(`/order/${orderId}`);
    } catch (e) {
      console.error('[AdminOrders] Navigation error:', e);
    }
  };

  const handleStatusChange = (orderId: string, newStatus: import('@/types').OrderStatus) => {
    updateOrderStatus(orderId, newStatus);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const closeAllSwipeables = useCallback((exceptOrderId?: string) => {
    Object.entries(swipeableRefs.current).forEach(([orderId, swipeable]) => {
      if (orderId !== exceptOrderId) {
        swipeable?.close();
      }
    });
  }, []);

  const enterSelectionMode = useCallback((orderId?: string) => {
    closeAllSwipeables();
    setIsSelectionMode(true);
    if (orderId) {
      setSelectedOrderIds(prev => prev.includes(orderId) ? prev : [...prev, orderId]);
    }
    Haptics.selectionAsync();
  }, [closeAllSwipeables]);

  const clearSelection = useCallback(() => {
    setSelectedOrderIds([]);
    setIsSelectionMode(false);
  }, []);

  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds(prev => {
      const isSelected = prev.includes(orderId);
      const next = isSelected ? prev.filter(id => id !== orderId) : [...prev, orderId];
      if (next.length === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
    Haptics.selectionAsync();
  }, []);

  const closeSwipeable = useCallback((orderId: string) => {
    swipeableRefs.current[orderId]?.close();
  }, []);

  const handleDeleteOrder = useCallback((orderId: string) => {
    closeSwipeable(orderId);
    Alert.alert(
      'Delete Order',
      'Are you sure you want to delete this order? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingOrderId(orderId);
              await deleteOrder(orderId);
            } catch (error) {
              console.error('[AdminOrders] Delete failed:', error);
            } finally {
              setDeletingOrderId((current) => (current === orderId ? null : current));
            }
          },
        },
      ]
    );
  }, [closeSwipeable, deleteOrder]);

  const exportSelectedOrders = useCallback(async (mode: ProcurementExportMode) => {
    if (selectedOrders.length === 0) return;

    try {
      setShowExportOptions(false);
      setIsExporting(true);
      const result = await generateAndShareProcurementCsv(selectedOrders, products, mode);
      const emptyMissingExport = mode === 'missing' && result.rowCount === 0;

      setAlertConfig({
        visible: true,
        title: emptyMissingExport ? 'No Missing Stock' : 'Export Ready',
        message: emptyMissingExport
          ? 'The selected orders do not have any stock shortfalls.'
          : `${result.rowCount} product row${result.rowCount === 1 ? '' : 's'} exported.`,
        type: emptyMissingExport ? 'info' : 'success',
      });
    } catch (error) {
      console.error('[AdminOrders] Procurement export failed:', error);
      setAlertConfig({
        visible: true,
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export selected order products.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [products, selectedOrders]);

  const handleExportSelectedOrders = useCallback(() => {
    if (selectedOrders.length === 0) {
      setAlertConfig({
        visible: true,
        title: 'No Orders Selected',
        message: 'Select at least one order before exporting.',
        type: 'warning',
      });
      return;
    }

    setShowExportOptions(true);
  }, [selectedOrders.length]);

  const renderDeleteAction = useCallback((orderId: string) => {
    const isDeleting = deletingOrderId === orderId;
    return (
      <TouchableOpacity
        style={[styles.swipeDeleteAction, isDeleting && styles.swipeDeleteActionDisabled]}
        onPress={() => handleDeleteOrder(orderId)}
        activeOpacity={0.8}
        disabled={isDeleting}
      >
        <Trash2 size={18} color="#fff" />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </TouchableOpacity>
    );
  }, [deletingOrderId, handleDeleteOrder]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.count}>
            {isSelectionMode ? `${selectedOrderIds.length} selected` : `${filteredOrders.length} orders`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={isSelectionMode ? clearSelection : () => enterSelectionMode()}
          accessibilityLabel={isSelectionMode ? 'Cancel order selection' : 'Select orders'}
        >
          {isSelectionMode ? (
            <X size={20} color={Colors.light.text} />
          ) : (
            <CheckSquare size={20} color={Colors.light.primary} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search orders..."
        />
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusFilters}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedStatus === item.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(item.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === item.id && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={sortedOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.orderList}
        renderItem={({ item }) => (
          <View style={styles.orderItem}>
            <Swipeable
              ref={(ref) => {
                swipeableRefs.current[item.id] = ref;
              }}
              renderLeftActions={() => isSelectionMode ? null : renderDeleteAction(item.id)}
              renderRightActions={() => isSelectionMode ? null : renderDeleteAction(item.id)}
              leftThreshold={36}
              rightThreshold={36}
              overshootLeft={false}
              overshootRight={false}
              onSwipeableWillOpen={() => closeAllSwipeables(item.id)}
            >
              <View>
                <OrderCard
                  order={item}
                  onPress={() => handleOrderPress(item.id)}
                  onLongPress={() => enterSelectionMode(item.id)}
                  showSalesRep
                  onStatusChange={isSelectionMode ? undefined : handleStatusChange}
                />
                {isSelectionMode && (
                  <TouchableOpacity
                    style={styles.selectionOverlay}
                    onPress={() => toggleOrderSelection(item.id)}
                    activeOpacity={0.8}
                    accessibilityLabel={selectedOrderIds.includes(item.id) ? 'Deselect order' : 'Select order'}
                  >
                    <View style={[
                      styles.selectionIndicator,
                      selectedOrderIds.includes(item.id) && styles.selectionIndicatorActive,
                    ]}>
                      {selectedOrderIds.includes(item.id) ? (
                        <CheckSquare size={20} color={Colors.light.primaryForeground} />
                      ) : (
                        <Square size={20} color={Colors.light.textTertiary} />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </Swipeable>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
      />

      {isSelectionMode && (
        <View style={styles.selectionBar}>
          <View>
            <Text style={styles.selectionCount}>{selectedOrderIds.length} selected</Text>
            <Text style={styles.selectionHint}>Export products from selected orders</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.exportButton,
              (selectedOrderIds.length === 0 || isExporting) && styles.exportButtonDisabled,
            ]}
            onPress={handleExportSelectedOrders}
            disabled={selectedOrderIds.length === 0 || isExporting}
          >
            <Download size={18} color={Colors.light.primaryForeground} />
            <Text style={styles.exportButtonText}>{isExporting ? 'Exporting...' : 'Export'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={showExportOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportOptions(false)}
      >
        <Pressable style={styles.exportModalOverlay} onPress={() => setShowExportOptions(false)}>
          <Pressable style={styles.exportModalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.exportModalHeader}>
              <View>
                <Text style={styles.exportModalTitle}>Export Selected Orders</Text>
                <Text style={styles.exportModalSubtitle}>
                  {selectedOrderIds.length} order{selectedOrderIds.length === 1 ? '' : 's'} selected
                </Text>
              </View>
              <TouchableOpacity
                style={styles.exportModalClose}
                onPress={() => setShowExportOptions(false)}
                accessibilityLabel="Close export options"
              >
                <X size={20} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.exportOptionsList}>
              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => exportSelectedOrders('all')}
                disabled={isExporting}
                activeOpacity={0.75}
              >
                <View style={styles.exportOptionIcon}>
                  <FileSpreadsheet size={22} color={Colors.light.primary} />
                </View>
                <View style={styles.exportOptionContent}>
                  <Text style={styles.exportOptionTitle}>All ordered products</Text>
                  <Text style={styles.exportOptionDescription}>
                    Export every product in the selected orders, grouped by SKU and variation.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportOption}
                onPress={() => exportSelectedOrders('missing')}
                disabled={isExporting}
                activeOpacity={0.75}
              >
                <View style={styles.exportOptionIcon}>
                  <PackageSearch size={22} color={Colors.light.primary} />
                </View>
                <View style={styles.exportOptionContent}>
                  <Text style={styles.exportOptionTitle}>Missing stock only</Text>
                  <Text style={styles.exportOptionDescription}>
                    Export only products where selected-order quantity is higher than current stock.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.exportModalCancel}
              onPress={() => setShowExportOptions(false)}
            >
              <Text style={styles.exportModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  count: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filtersList: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.light.primaryForeground,
  },
  orderList: {
    paddingHorizontal: 20,
    paddingBottom: 104,
  },
  orderItem: {
    marginBottom: 12,
  },
  swipeDeleteAction: {
    width: 92,
    marginVertical: 2,
    borderRadius: 16,
    backgroundColor: Colors.light.danger,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeDeleteActionDisabled: {
    opacity: 0.7,
  },
  swipeDeleteText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textTertiary,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  selectionIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  selectionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  selectionCount: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  selectionHint: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.primaryForeground,
  },
  exportModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(23, 23, 23, 0.48)',
  },
  exportModalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  exportModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  exportModalSubtitle: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  exportModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOptionsList: {
    gap: 10,
    padding: 14,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  exportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOptionContent: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  exportOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.light.textSecondary,
    marginTop: 3,
  },
  exportModalCancel: {
    marginHorizontal: 14,
    marginBottom: 14,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportModalCancelText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
});
