import { useState, useMemo, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Package, Trash2 } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import SearchBar from '@/components/SearchBar';
import OrderCard from '@/components/OrderCard';
import Colors from '@/constants/colors';
import { OrderStatus } from '@/types';

const statusFilters: { id: OrderStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
];

export default function SalesOrders() {
  const router = useRouter();
  const { getOrdersBySalesRep, deleteOrder } = useData();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  const myOrders = useMemo(() => {
    return getOrdersBySalesRep(user?.id || '');
  }, [user?.id, getOrdersBySalesRep]);

  const filteredOrders = useMemo(() => {
    return myOrders.filter(order => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myOrders, searchQuery, selectedStatus]);

  const handleOrderPress = (orderId: string) => {
    try {
      console.log('[Orders] Navigating to order:', orderId);
      router.push(`/order/${orderId}`);
    } catch (e) {
      console.error('[Orders] Navigation error:', e);
    }
  };

  const closeAllSwipeables = useCallback((exceptOrderId?: string) => {
    Object.entries(swipeableRefs.current).forEach(([orderId, swipeable]) => {
      if (orderId !== exceptOrderId) {
        swipeable?.close();
      }
    });
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
              console.error('[Orders] Delete failed:', error);
            } finally {
              setDeletingOrderId((current) => (current === orderId ? null : current));
            }
          },
        },
      ]
    );
  }, [closeSwipeable, deleteOrder]);

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
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.count}>{filteredOrders.length} orders</Text>
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
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.orderList}
        renderItem={({ item }) => (
          <View style={styles.orderItem}>
            <Swipeable
              ref={(ref) => {
                swipeableRefs.current[item.id] = ref;
              }}
              renderLeftActions={() => renderDeleteAction(item.id)}
              renderRightActions={() => renderDeleteAction(item.id)}
              leftThreshold={36}
              rightThreshold={36}
              overshootLeft={false}
              overshootRight={false}
              onSwipeableWillOpen={() => closeAllSwipeables(item.id)}
            >
              <OrderCard order={item} onPress={() => handleOrderPress(item.id)} />
            </Swipeable>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={64} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Start creating orders from the catalog'}
            </Text>
          </View>
        }
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
    alignItems: 'baseline',
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
    paddingBottom: 24,
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
});
