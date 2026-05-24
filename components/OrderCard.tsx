import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Pressable, Animated, Dimensions } from 'react-native';
import { ChevronRight, ChevronDown, Check, CloudUpload, AlertCircle, RefreshCw } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_CONFIG, ORDER_STATUS_OPTIONS, normalizeOrderStatus } from '@/lib/order-status';
import Badge from './Badge';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  onLongPress?: () => void;
  showSalesRep?: boolean;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
}

const allStatuses = ORDER_STATUS_OPTIONS.map(option => option.id);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OrderCard({ order, onPress, onLongPress, showSalesRep = false, onStatusChange }: OrderCardProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showStatusDropdown) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showStatusDropdown, fadeAnim, slideAnim]);

  const closeDropdown = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowStatusDropdown(false));
  };
  const formatDate = (dateString: string | undefined) => {
    const date = dateString ? new Date(dateString) : new Date(NaN);
    if (!Number.isFinite(date.getTime())) {
      return 'Unknown date';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number | undefined) => {
    const safePrice = typeof price === 'number' && Number.isFinite(price) ? price : 0;
    return `R${safePrice.toFixed(2)}`;
  };

  const currentStatus = normalizeOrderStatus(order.status);
  const status = ORDER_STATUS_CONFIG[currentStatus];
  const orderNumber = order.orderNumber || 'Order';
  const customerName = order.customerName || 'Unnamed customer';
  const salesRepName = order.salesRepName || 'Unassigned';
  const items = Array.isArray(order.items) ? order.items : [];

  const handleStatusPress = (e: any) => {
    e.stopPropagation();
    if (onStatusChange) {
      setShowStatusDropdown(true);
    }
  };

  const handleStatusSelect = (newStatus: OrderStatus) => {
    if (onStatusChange && newStatus !== currentStatus) {
      onStatusChange(order.id, newStatus);
    }
    closeDropdown();
  };

  const isSynced = !!order?.orderNumber && order.orderNumber !== 'PENDING-SYNC';
  const lastSyncedAt = order?.lastSyncedAt ? new Date(order.lastSyncedAt) : null;
  const updatedAt = order?.updatedAt ? new Date(order.updatedAt) : new Date();
  const isUpToDate = isSynced && (!lastSyncedAt || lastSyncedAt.getTime() >= updatedAt.getTime() - 1000);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View>
          <View style={styles.orderNumberRow}>
            <Text style={styles.orderNumber}>{orderNumber}</Text>
            {isSynced && isUpToDate && (
              <View style={[styles.syncIcon, { backgroundColor: Colors.light.success + '20' }]}>
                <Check size={12} color={Colors.light.success} strokeWidth={3} />
              </View>
            )}
            {isSynced && !isUpToDate && (
              <View style={[styles.syncIcon, { backgroundColor: Colors.light.warning + '20' }]}>
                <RefreshCw size={12} color={Colors.light.warning} strokeWidth={3} />
              </View>
            )}
            {!isSynced && (
              <View style={[styles.syncIcon, { backgroundColor: Colors.light.border }]}>
                <CloudUpload size={12} color={Colors.light.textTertiary} strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
        </View>
        {onStatusChange ? (
          <TouchableOpacity
            style={styles.statusButton}
            onPress={handleStatusPress}
            activeOpacity={0.7}
          >
            <Badge label={status.label} variant={status.variant} />
            <ChevronDown size={14} color={Colors.light.textTertiary} style={styles.statusChevron} />
          </TouchableOpacity>
        ) : (
          <Badge label={status.label} variant={status.variant} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.customerName}>{customerName}</Text>
        {showSalesRep && (
          <Text style={styles.salesRep}>Rep: {salesRepName}</Text>
        )}
        <Text style={styles.items}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
        </View>
        <ChevronRight size={20} color={Colors.light.textTertiary} />
      </View>

      <Modal
        visible={showStatusDropdown}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <Animated.View
            style={[styles.dropdownOverlay, { opacity: fadeAnim }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDropdown} />
          </Animated.View>

          <Animated.View
            style={[
              styles.dropdownContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.dropdownHandle} />
            <Text style={styles.dropdownTitle}>Update Status</Text>
            <Text style={styles.dropdownSubtitle}>{orderNumber}</Text>

            <View style={styles.statusGrid}>
              {allStatuses.map((statusKey) => {
                const config = ORDER_STATUS_CONFIG[statusKey];
                const isSelected = statusKey === currentStatus;
                return (
                  <TouchableOpacity
                    key={statusKey}
                    style={[
                      styles.statusOption,
                      isSelected && styles.statusOptionSelected,
                    ]}
                    onPress={() => handleStatusSelect(statusKey)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.statusDot,
                      config.variant === 'warning' && styles.statusDotWarning,
                      config.variant === 'info' && styles.statusDotInfo,
                      config.variant === 'success' && styles.statusDotSuccess,
                      config.variant === 'danger' && styles.statusDotDanger,
                    ]} />
                    <Text style={[
                      styles.statusOptionText,
                      isSelected && styles.statusOptionTextSelected,
                    ]}>
                      {config.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkContainer}>
                        <Check size={16} color={Colors.light.primary} strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeDropdown}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  body: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.light.borderLight,
    paddingVertical: 12,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  salesRep: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  items: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.surfaceSecondary,
    paddingRight: 8,
    paddingLeft: 2,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusChevron: {
    marginLeft: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dropdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownContainer: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  dropdownHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  dropdownTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  dropdownSubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  statusGrid: {
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  statusOptionSelected: {
    backgroundColor: Colors.light.primary + '15',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusDotWarning: {
    backgroundColor: Colors.light.warning,
  },
  statusDotInfo: {
    backgroundColor: Colors.light.info,
  },
  statusDotSuccess: {
    backgroundColor: Colors.light.success,
  },
  statusDotDanger: {
    backgroundColor: Colors.light.danger,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  statusOptionTextSelected: {
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
});
