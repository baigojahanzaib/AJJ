import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, Share, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText, Calendar, Package,
  ChevronDown, Edit3, Share2, RotateCcw, X, Check, Clock, Minus, Plus, Trash2, Printer
} from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import Badge from '@/components/Badge';
import ThemedAlert from '@/components/ThemedAlert';
import Input from '@/components/Input';
import Colors from '@/constants/colors';
import { OrderStatus, OrderItem } from '@/types';
import { generateAndSharePDF } from '@/lib/pdf-generator';

const statusOptions: { id: OrderStatus; label: string; color: 'default' | 'success' | 'warning' | 'danger' | 'info' }[] = [
  { id: 'pending', label: 'Pending', color: 'warning' },
  { id: 'confirmed', label: 'Confirmed', color: 'info' },
  { id: 'processing', label: 'Processing', color: 'info' },
  { id: 'shipped', label: 'Shipped', color: 'info' },
  { id: 'delivered', label: 'Delivered', color: 'success' },
  { id: 'cancelled', label: 'Cancelled', color: 'danger' },
];

export default function OrderDetailPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, updateOrder, undoOrderEdit } = useData();
  const { user } = useAuth();
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<OrderStatus>('pending');
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editDiscount, setEditDiscount] = useState('0');

  const order = orders.find(o => o.id === id);
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || order?.salesRepId === user?.id;
  const canUndo = !!order?.previousVersion;

  const editedTotals = useMemo(() => {
    const subtotal = editItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = parseFloat(editDiscount) || 0;
    const tax = (subtotal - discount) * 0.09;
    const total = subtotal - discount + tax;
    return { subtotal, tax, total };
  }, [editItems, editDiscount]);

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Package size={64} color={Colors.light.textTertiary} />
          <Text style={styles.emptyTitle}>Order not found</Text>
          <Text style={styles.emptySubtitle}>This order may have been deleted or does not exist.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatus = statusOptions.find(s => s.id === order.status);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStatusSelect = (status: OrderStatus) => {
    setShowStatusPicker(false);
    updateOrderStatus(order.id, status);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAlertConfig({
      visible: true,
      title: 'Status Updated',
      message: `Order status changed to ${statusOptions.find(s => s.id === status)?.label}`,
      type: 'success',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  };

  const handleShare = async () => {
    try {
      const itemsList = order.items.map(item =>
        `• ${item.productName} x${item.quantity} - R${item.totalPrice.toFixed(2)}`
      ).join('\n');

      const message = `Order: ${order.orderNumber}
Status: ${currentStatus?.label || order.status}
Customer: ${order.customerName}
Phone: ${order.customerPhone}

Items:
${itemsList}

Subtotal: R${order.subtotal.toFixed(2)}
Tax: R${order.tax.toFixed(2)}
${order.discount > 0 ? `Discount: -R${order.discount.toFixed(2)}\n` : ''}Total: R${order.total.toFixed(2)}`;

      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
        setAlertConfig({
          visible: true,
          title: 'Copied',
          message: 'Order details copied to clipboard',
          type: 'success',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      } else {
        await Share.share({ message, title: `Order ${order.orderNumber}` });
      }
      Haptics.selectionAsync();
    } catch (error) {
      console.error('[Order] Share error:', error);
    }
  };

  const handlePrint = async () => {
    try {
      await generateAndSharePDF(order);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to generate PDF.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  };

  const openEditModal = () => {
    setEditCustomerName(order.customerName);
    setEditCustomerPhone(order.customerPhone);
    setEditCustomerEmail(order.customerEmail);
    setEditCustomerAddress(order.customerAddress);
    setEditNotes(order.notes);
    setEditStatus(order.status);
    setEditItems([...order.items]);
    setEditDiscount(order.discount.toString());
    setShowEditModal(true);
    Haptics.selectionAsync();
  };

  const handleSaveEdit = () => {
    const changes: string[] = [];

    if (editCustomerName !== order.customerName) changes.push('customer name');
    if (editCustomerPhone !== order.customerPhone) changes.push('phone');
    if (editCustomerEmail !== order.customerEmail) changes.push('email');
    if (editCustomerAddress !== order.customerAddress) changes.push('address');
    if (editNotes !== order.notes) changes.push('notes');
    if (editStatus !== order.status) changes.push('status');
    if (editDiscount !== order.discount.toString()) changes.push('discount');
    if (JSON.stringify(editItems) !== JSON.stringify(order.items)) changes.push('items');

    if (changes.length === 0) {
      setShowEditModal(false);
      return;
    }

    const changeDescription = `Updated: ${changes.join(', ')}`;

    updateOrder(
      order.id,
      {
        customerName: editCustomerName,
        customerPhone: editCustomerPhone,
        customerEmail: editCustomerEmail,
        customerAddress: editCustomerAddress,
        notes: editNotes,
        status: editStatus,
        items: editItems,
        subtotal: editedTotals.subtotal,
        tax: editedTotals.tax,
        discount: parseFloat(editDiscount) || 0,
        total: editedTotals.total,
      },
      user?.id || '',
      user?.name || '',
      changeDescription
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditModal(false);
    setAlertConfig({
      visible: true,
      title: 'Order Updated',
      message: 'Your changes have been saved. You can undo this edit if needed.',
      type: 'success',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  };

  const handleUndo = () => {
    setAlertConfig({
      visible: true,
      title: 'Undo Changes',
      message: 'Revert to the previous version of this order?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: () => {
            undoOrderEdit(order.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
      ],
    });
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setEditItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        quantity: newQuantity,
        totalPrice: item.unitPrice * newQuantity,
      };
    }));
  };

  const removeItem = (itemId: string) => {
    if (editItems.length <= 1) {
      setAlertConfig({
        visible: true,
        title: 'Cannot Remove',
        message: 'Order must have at least one item.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    setEditItems(prev => prev.filter(item => item.id !== itemId));
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEditModal(false)}
    >
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowEditModal(false)}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Order</Text>
          <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
            <Check size={24} color={Colors.light.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>Customer Information</Text>
            <Input
              label="Customer Name"
              value={editCustomerName}
              onChangeText={setEditCustomerName}
              containerStyle={styles.editInput}
            />
            <Input
              label="Phone Number"
              value={editCustomerPhone}
              onChangeText={setEditCustomerPhone}
              keyboardType="phone-pad"
              containerStyle={styles.editInput}
            />
            <Input
              label="Email"
              value={editCustomerEmail}
              onChangeText={setEditCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={styles.editInput}
            />
            <Input
              label="Address"
              value={editCustomerAddress}
              onChangeText={setEditCustomerAddress}
              multiline
              containerStyle={styles.editInput}
            />
          </View>

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>Order Items</Text>
            {editItems.map((item) => (
              <View key={item.id} style={styles.editItemCard}>
                <Image
                  source={{ uri: item.productImage }}
                  style={styles.editItemImage}
                  contentFit="cover"
                />
                <View style={styles.editItemInfo}>
                  <Text style={styles.editItemName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.editItemPrice}>R{item.unitPrice.toFixed(2)} each</Text>
                  <View style={styles.editItemActions}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateItemQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={14} color={Colors.light.text} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateItemQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={14} color={Colors.light.text} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => removeItem(item.id)}>
                      <Trash2 size={18} color={Colors.light.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.editItemTotal}>R{item.totalPrice.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>Discount</Text>
            <View style={styles.discountInput}>
              <Text style={styles.discountCurrency}>R</Text>
              <TextInput
                style={styles.discountField}
                value={editDiscount}
                onChangeText={setEditDiscount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.light.textTertiary}
              />
            </View>
          </View>

          <View style={styles.editSection}>
            <Text style={styles.editSectionTitle}>Order Notes</Text>
            <Input
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={3}
              placeholder="Add notes..."
            />
          </View>

          <View style={styles.editSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>R{editedTotals.subtotal.toFixed(2)}</Text>
            </View>
            {parseFloat(editDiscount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>
                  -${parseFloat(editDiscount).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax (9%)</Text>
              <Text style={styles.summaryValue}>R{editedTotals.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R{editedTotals.total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{order.orderNumber}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
            <Share2 size={20} color={Colors.light.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handlePrint}>
            <Printer size={20} color={Colors.light.text} />
          </TouchableOpacity>
          {canEdit && (
            <TouchableOpacity style={styles.headerBtn} onPress={openEditModal}>
              <Edit3 size={20} color={Colors.light.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusSection}>
          <Badge
            label={currentStatus?.label || order.status}
            variant={currentStatus?.color || 'default'}
          />
          <View style={styles.dateContainer}>
            <Calendar size={14} color={Colors.light.textTertiary} />
            <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
          </View>
        </View>

        {canUndo && (
          <TouchableOpacity style={styles.undoBanner} onPress={handleUndo}>
            <View style={styles.undoContent}>
              <RotateCcw size={18} color={Colors.light.info} />
              <View style={styles.undoTextContainer}>
                <Text style={styles.undoTitle}>Changes made</Text>
                <Text style={styles.undoSubtitle}>Tap to undo recent edit</Text>
              </View>
            </View>
            <Text style={styles.undoAction}>Undo</Text>
          </TouchableOpacity>
        )}

        {order.editLog && order.editLog.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit History</Text>
            <View style={styles.card}>
              {order.editLog.slice(-3).reverse().map((log, index) => (
                <View key={index} style={[styles.logItem, index > 0 && styles.logItemBorder]}>
                  <View style={styles.logIcon}>
                    <Clock size={14} color={Colors.light.textTertiary} />
                  </View>
                  <View style={styles.logContent}>
                    <Text style={styles.logText}>{log.changes}</Text>
                    <Text style={styles.logMeta}>
                      {log.editedByName} • {formatDate(log.editedAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.card}>
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

        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sales Representative</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <User size={18} color={Colors.light.textTertiary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{order.salesRepName}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items ({order.items.length})</Text>
          <View style={styles.card}>
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
                    <Text style={styles.itemPrice}>R{item.totalPrice.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>R{order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>R{order.tax.toFixed(2)}</Text>
            </View>
            {order.discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>
                  -${order.discount.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R{order.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Notes</Text>
            <View style={styles.card}>
              <View style={styles.notesRow}>
                <FileText size={18} color={Colors.light.textTertiary} />
                <Text style={styles.notesText}>{order.notes}</Text>
              </View>
            </View>
          </View>
        )}

        {canEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Status Update</Text>
            <TouchableOpacity
              style={styles.statusPicker}
              onPress={() => setShowStatusPicker(!showStatusPicker)}
            >
              <Text style={styles.statusPickerText}>{currentStatus?.label}</Text>
              <ChevronDown size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            {showStatusPicker && (
              <View style={styles.statusOptions}>
                {statusOptions.map((status) => (
                  <TouchableOpacity
                    key={status.id}
                    style={[
                      styles.statusOption,
                      order.status === status.id && styles.statusOptionActive,
                    ]}
                    onPress={() => handleStatusSelect(status.id)}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        order.status === status.id && styles.statusOptionTextActive,
                      ]}
                    >
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: Math.max(insets.bottom, 40) }} />
      </ScrollView>

      {renderEditModal()}

      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.surface,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    backgroundColor: Colors.light.infoLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.info,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  undoTextContainer: {
    gap: 2,
  },
  undoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  undoSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  undoAction: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.info,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  logItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  logItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  logIcon: {
    marginTop: 2,
  },
  logContent: {
    flex: 1,
  },
  logText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  logMeta: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
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
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
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
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
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
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  notesRow: {
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
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
  bottomPadding: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  modalContent: {
    flex: 1,
  },
  editSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  editSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  editInput: {
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statusChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  statusChipTextActive: {
    color: Colors.light.primaryForeground,
  },
  editItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  editItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  editItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  editItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  editItemPrice: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  editItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    minWidth: 20,
    textAlign: 'center',
  },
  editItemTotal: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  discountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  discountCurrency: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  discountField: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 14,
  },
  editSummary: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 16,
  },
});
