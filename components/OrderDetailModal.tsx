import { useState } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { X, Eye, Edit3, Package, User, Phone, Mail, MapPin, FileText, ChevronDown } from 'lucide-react-native';
import { Order, OrderStatus } from '@/types';
import Colors from '@/constants/colors';
import Badge from '@/components/Badge';
import Button from '@/components/Button';

interface OrderDetailModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onEdit?: (order: Order) => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
  mode?: 'quick' | 'view' | 'edit';
}

const statusOptions: { id: OrderStatus; label: string; color: 'default' | 'success' | 'warning' | 'danger' | 'info' }[] = [
  { id: 'pending', label: 'Pending', color: 'warning' },
  { id: 'confirmed', label: 'Confirmed', color: 'info' },
  { id: 'processing', label: 'Processing', color: 'info' },
  { id: 'shipped', label: 'Shipped', color: 'info' },
  { id: 'delivered', label: 'Delivered', color: 'success' },
  { id: 'cancelled', label: 'Cancelled', color: 'danger' },
];

export default function OrderDetailModal({ 
  visible, 
  order, 
  onClose, 
  onEdit,
  onUpdateStatus,
  mode = 'quick' 
}: OrderDetailModalProps) {
  const [viewMode, setViewMode] = useState<'quick' | 'view' | 'edit'>(mode);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);

  if (!order) return null;

  const currentStatus = statusOptions.find(s => s.id === order.status);

  const handleViewDetails = () => {
    setViewMode('view');
  };

  const handleEdit = () => {
    setViewMode('edit');
    if (onEdit) {
      onEdit(order);
    }
  };

  const handleStatusSelect = (status: OrderStatus) => {
    setSelectedStatus(status);
    setShowStatusPicker(false);
    if (onUpdateStatus) {
      onUpdateStatus(order.id, status);
    }
  };

  const handleClose = () => {
    setViewMode('quick');
    setShowStatusPicker(false);
    setSelectedStatus(null);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderQuickView = () => (
    <View style={styles.quickContent}>
      <View style={styles.quickHeader}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <Badge 
          label={currentStatus?.label || order.status} 
          variant={currentStatus?.color || 'default'} 
        />
      </View>

      <View style={styles.quickInfoRow}>
        <View style={styles.quickInfoItem}>
          <User size={16} color={Colors.light.textTertiary} />
          <Text style={styles.quickInfoText}>{order.customerName}</Text>
        </View>
        <View style={styles.quickInfoItem}>
          <Package size={16} color={Colors.light.textTertiary} />
          <Text style={styles.quickInfoText}>{order.items.length} items</Text>
        </View>
      </View>

      <View style={styles.quickTotal}>
        <Text style={styles.quickTotalLabel}>Total</Text>
        <Text style={styles.quickTotalValue}>${order.total.toFixed(2)}</Text>
      </View>

      <View style={styles.quickActions}>
        <Button
          title="View Details"
          variant="outline"
          onPress={handleViewDetails}
          icon={<Eye size={18} color={Colors.light.text} />}
          style={styles.quickActionButton}
        />
        <Button
          title="Edit Order"
          variant="primary"
          onPress={handleEdit}
          icon={<Edit3 size={18} color={Colors.light.primaryForeground} />}
          style={styles.quickActionButton}
        />
      </View>
    </View>
  );

  const renderDetailView = () => (
    <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
      <View style={styles.detailHeader}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <Badge 
          label={currentStatus?.label || order.status} 
          variant={currentStatus?.color || 'default'} 
        />
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <User size={18} color={Colors.light.textTertiary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{order.customerName}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Phone size={18} color={Colors.light.textTertiary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{order.customerPhone}</Text>
            </View>
          </View>
          {order.customerEmail && (
            <View style={styles.infoRow}>
              <Mail size={18} color={Colors.light.textTertiary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{order.customerEmail}</Text>
              </View>
            </View>
          )}
          {order.customerAddress && (
            <View style={styles.infoRow}>
              <MapPin size={18} color={Colors.light.textTertiary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{order.customerAddress}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Sales Representative</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <User size={18} color={Colors.light.textTertiary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{order.salesRepName}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        <View style={styles.itemsCard}>
          {order.items.map((item, index) => (
            <View key={item.id} style={[styles.orderItem, index > 0 && styles.orderItemBorder]}>
              <Image
                source={{ uri: item.productImage }}
                style={styles.itemImage}
                contentFit="cover"
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
                <Text style={styles.itemSku}>SKU: {item.productSku}</Text>
                {item.selectedVariations.length > 0 && (
                  <Text style={styles.itemVariations}>
                    {item.selectedVariations.map(v => v.optionName).join(' / ')}
                  </Text>
                )}
                <View style={styles.itemPriceRow}>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>${item.totalPrice.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>${order.tax.toFixed(2)}</Text>
          </View>
          {order.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, styles.discountValue]}>-${order.discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${order.total.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {order.notes && (
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Order Notes</Text>
          <View style={styles.notesCard}>
            <FileText size={18} color={Colors.light.textTertiary} />
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        </View>
      )}

      <View style={styles.detailSection}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        <TouchableOpacity 
          style={styles.statusPicker}
          onPress={() => setShowStatusPicker(!showStatusPicker)}
        >
          <Text style={styles.statusPickerText}>
            {selectedStatus 
              ? statusOptions.find(s => s.id === selectedStatus)?.label 
              : currentStatus?.label}
          </Text>
          <ChevronDown size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
        
        {showStatusPicker && (
          <View style={styles.statusOptions}>
            {statusOptions.map((status) => (
              <TouchableOpacity
                key={status.id}
                style={[
                  styles.statusOption,
                  (selectedStatus || order.status) === status.id && styles.statusOptionActive,
                ]}
                onPress={() => handleStatusSelect(status.id)}
              >
                <Text style={[
                  styles.statusOptionText,
                  (selectedStatus || order.status) === status.id && styles.statusOptionTextActive,
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.detailActions}>
        <Button
          title="Edit Order"
          variant="primary"
          onPress={handleEdit}
          fullWidth
          icon={<Edit3 size={18} color={Colors.light.primaryForeground} />}
        />
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.container, viewMode !== 'quick' && styles.containerFull]} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {viewMode === 'quick' ? 'Order Details' : viewMode === 'view' ? 'Order Details' : 'Edit Order'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          {viewMode === 'quick' ? renderQuickView() : renderDetailView()}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '50%',
    overflow: 'hidden',
  },
  containerFull: {
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  quickContent: {
    padding: 20,
  },
  quickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  quickInfoRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickInfoText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  quickTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    marginBottom: 16,
  },
  quickTotalLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  quickTotalValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
  },
  detailContent: {
    padding: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500' as const,
  },
  itemsCard: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
  },
  orderItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  orderItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.light.surface,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  itemSku: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginBottom: 2,
  },
  itemVariations: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  itemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemQuantity: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  summaryCard: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  discountValue: {
    color: Colors.light.success,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  notesCard: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  notesText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  statusPicker: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPickerText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  statusOptions: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  statusOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  statusOptionActive: {
    backgroundColor: Colors.light.primary,
  },
  statusOptionText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  statusOptionTextActive: {
    color: Colors.light.primaryForeground,
    fontWeight: '600' as const,
  },
  detailActions: {
    paddingBottom: 20,
  },
});
