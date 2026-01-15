import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Pressable, Animated, Dimensions } from 'react-native';
import { ChevronRight, ChevronDown, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Order, OrderStatus } from '@/types';
import Badge from './Badge';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  showSalesRep?: boolean;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
}

const statusConfig: Record<OrderStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'info' },
  processing: { label: 'Processing', variant: 'info' },
  shipped: { label: 'Shipped', variant: 'info' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
};

const allStatuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OrderCard({ order, onPress, showSalesRep = false, onStatusChange }: OrderCardProps) {
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
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return `R${price.toFixed(2)}`;
  };

  const status = statusConfig[order.status];

  const handleStatusPress = (e: any) => {
    e.stopPropagation();
    if (onStatusChange) {
      setShowStatusDropdown(true);
    }
  };

  const handleStatusSelect = (newStatus: OrderStatus) => {
    if (onStatusChange && newStatus !== order.status) {
      onStatusChange(order.id, newStatus);
    }
    closeDropdown();
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
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
        <Text style={styles.customerName}>{order.customerName}</Text>
        {showSalesRep && (
          <Text style={styles.salesRep}>Rep: {order.salesRepName}</Text>
        )}
        <Text style={styles.items}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
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
            <Text style={styles.dropdownSubtitle}>{order.orderNumber}</Text>

            <View style={styles.statusGrid}>
              {allStatuses.map((statusKey) => {
                const config = statusConfig[statusKey];
                const isSelected = statusKey === order.status;
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
    ...StyleSheet.absoluteFillObject,
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
