import { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal, TextInput, Share, Platform, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText, Calendar, Package,
  ChevronDown, Edit3, Share2, RotateCcw, X, Check, Clock, Minus, Plus, Trash2, Printer,
  CloudUpload, RefreshCw
} from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import Badge from '@/components/Badge';
import ThemedAlert from '@/components/ThemedAlert';
import Input from '@/components/Input';
import Colors from '@/constants/colors';
import { OrderStatus, OrderItem, Product, SelectedVariation } from '@/types';
import { generateAndSharePDF } from '@/lib/pdf-generator';
import { generateAndShareCSV } from '@/lib/csv-generator';

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
  const { orders, updateOrderStatus, updateOrder, undoOrderEdit, deleteOrder, syncOrderToEcwid, resolveImageUri, activeProducts } = useData();
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

  // Price editing state for order items
  const [editingItemPriceId, setEditingItemPriceId] = useState<string | null>(null);
  const [editingItemPriceValue, setEditingItemPriceValue] = useState('');
  const [editQuantityDrafts, setEditQuantityDrafts] = useState<Record<string, string>>({});
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const order = orders.find(o => o.id === id);
  const isAdmin = user?.role === 'admin';
  const canEdit = isAdmin || order?.salesRepId === user?.id;
  const canUndo = !!order?.previousVersion;

  const isSynced = !!order?.ecwidOrderId;
  const lastSyncedAtRaw = (order as any)?.lastSyncedAt as string | undefined;
  const lastSyncedAt = lastSyncedAtRaw ? new Date(lastSyncedAtRaw) : null;
  const updatedAt = order?.updatedAt ? new Date(order.updatedAt) : new Date();

  // If never synced, it's not up to date.
  // If synced, check if sync time is after update time.
  // We add a small buffer (e.g. 1s) because sometimes update writes happen slightly after sync timestamp generation
  const isUpToDate = !!(isSynced && lastSyncedAt && lastSyncedAt.getTime() >= updatedAt.getTime() - 1000);

  const editedTotals = useMemo(() => {
    const subtotal = editItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = parseFloat(editDiscount) || 0;
    const tax = (subtotal - discount) * 0.09;
    const total = subtotal - discount + tax;
    return { subtotal, tax, total };
  }, [editItems, editDiscount]);

  useEffect(() => {
    setEditQuantityDrafts(prev => {
      const next: Record<string, string> = {};
      editItems.forEach(item => {
        next[item.id] = prev[item.id] ?? item.quantity.toString();
      });
      return next;
    });
  }, [editItems]);

  const filteredProductsForAdd = useMemo(() => {
    const query = addItemSearch.trim().toLowerCase();
    if (!query) return activeProducts.slice(0, 120);

    return activeProducts
      .filter(product => {
        const variationSearchText = product.variations
          .flatMap(variation => [variation.name, ...variation.options.map(option => option.name)])
          .join(' ')
          .toLowerCase();

        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          variationSearchText.includes(query)
        );
      })
      .slice(0, 120);
  }, [activeProducts, addItemSearch]);

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

  const handlePrint = () => {
    setAlertConfig({
      visible: true,
      title: 'Export Order',
      message: 'Choose a format to export this order:',
      type: 'info',
      buttons: [
        {
          text: 'Export CSV',
          style: 'default',
          onPress: () => {
            // Wait for modal to close before starting export
            setTimeout(async () => {
              console.log('Timeout fired, starting CSV export...');
              try {
                await generateAndShareCSV(order);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                console.error('Error generating CSV:', error);
                setAlertConfig({
                  visible: true,
                  title: 'Error',
                  message: 'Failed to generate CSV.',
                  type: 'error',
                  buttons: [{ text: 'OK', style: 'default' }],
                });
              }
            }, 1000);
          },
        },
        {
          text: 'Export PDF',
          style: 'default',
          onPress: () => {
            // Wait for modal to close before starting export
            setTimeout(async () => {
              console.log('Timeout fired, starting PDF export...');
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
            }, 1000);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    });
    Haptics.selectionAsync();
  };

  const getVariationKey = (selectedVariations: SelectedVariation[]): string => {
    return selectedVariations
      .map(v => `${v.variationId}:${v.optionId}`)
      .sort()
      .join('|');
  };

  const getDefaultSelections = (product: Product): SelectedVariation[] => {
    return product.variations
      .map(variation => {
        const firstOption = variation.options[0];
        if (!firstOption) return null;

        return {
          variationId: variation.id,
          variationName: variation.name,
          optionId: firstOption.id,
          optionName: firstOption.name,
          priceModifier: firstOption.priceModifier,
        } as SelectedVariation;
      })
      .filter((selection): selection is SelectedVariation => !!selection);
  };

  const getDefaultUnitPrice = (product: Product, selections: SelectedVariation[]): number => {
    if (product.combinations && product.combinations.length > 0) {
      const match = product.combinations.find(combo =>
        combo.options.every(comboOption =>
          selections.some(selected =>
            selected.variationName.trim().toLowerCase() === comboOption.name.trim().toLowerCase() &&
            selected.optionName.trim().toLowerCase() === comboOption.value.trim().toLowerCase()
          )
        )
      );

      if (match) return match.price;
    }

    return product.basePrice + selections.reduce((sum, selection) => sum + selection.priceModifier, 0);
  };

  const formatSelectedVariations = (selectedVariations: SelectedVariation[]): string => {
    if (!selectedVariations.length) return '';
    return selectedVariations
      .map(variation => `${variation.variationName}: ${variation.optionName}`)
      .join(' • ');
  };

  const getDefaultVariationSummary = (product: Product): string => {
    if (!product.variations.length) return '';

    const parts = product.variations
      .map(variation => {
        const firstOption = variation.options[0];
        if (!firstOption) return null;
        return `${variation.name}: ${firstOption.name}`;
      })
      .filter((value): value is string => !!value);

    return parts.join(' • ');
  };

  const addProductToEditItems = (product: Product) => {
    const selections = getDefaultSelections(product);
    const unitPrice = getDefaultUnitPrice(product, selections);
    const variationKey = getVariationKey(selections);

    setEditItems(prev => {
      const existingIndex = prev.findIndex(item =>
        item.productId === product.id && getVariationKey(item.selectedVariations) === variationKey
      );

      if (existingIndex >= 0) {
        const next = [...prev];
        const existingItem = next[existingIndex];
        const nextQuantity = existingItem.quantity + 1;
        next[existingIndex] = {
          ...existingItem,
          quantity: nextQuantity,
          totalPrice: existingItem.unitPrice * nextQuantity,
        };
        return next;
      }

      const newItem: OrderItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productImage: product.images[0] || '',
        selectedVariations: selections,
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice,
      };

      return [...prev, newItem];
    });

    setShowAddItemModal(false);
    setAddItemSearch('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    setEditQuantityDrafts(
      Object.fromEntries(order.items.map(item => [item.id, `${item.quantity}`]))
    );
    setEditingItemPriceId(null);
    setEditingItemPriceValue('');
    setShowAddItemModal(false);
    setAddItemSearch('');
    setShowEditModal(true);
    Haptics.selectionAsync();
  };

  const applyPendingPriceEdit = (itemsToUpdate: OrderItem[]): OrderItem[] => {
    if (!editingItemPriceId) return itemsToUpdate;

    const pendingPrice = parseFloat(editingItemPriceValue);
    if (isNaN(pendingPrice) || pendingPrice < 0) return itemsToUpdate;

    return itemsToUpdate.map(item => {
      if (item.id !== editingItemPriceId) return item;
      return {
        ...item,
        unitPrice: pendingPrice,
        totalPrice: pendingPrice * item.quantity,
      };
    });
  };

  const getNormalizedEditItems = (itemsToNormalize: OrderItem[]): OrderItem[] => {
    let nextItems = itemsToNormalize.map(item => {
      const draftRaw = (editQuantityDrafts[item.id] ?? `${item.quantity}`).trim();
      const parsed = parseInt(draftRaw, 10);
      const quantity = Number.isFinite(parsed) && parsed > 0 ? parsed : item.quantity;

      return {
        ...item,
        quantity,
        totalPrice: item.unitPrice * quantity,
      };
    });

    nextItems = applyPendingPriceEdit(nextItems);
    return nextItems;
  };

  const handleSaveEdit = async () => {
    if (isSavingEdit) return;

    const normalizedItems = getNormalizedEditItems(editItems);
    const discount = parseFloat(editDiscount) || 0;
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = (subtotal - discount) * 0.09;
    const total = subtotal - discount + tax;

    const changes: string[] = [];

    if (editCustomerName !== order.customerName) changes.push('customer name');
    if (editCustomerPhone !== order.customerPhone) changes.push('phone');
    if (editCustomerEmail !== order.customerEmail) changes.push('email');
    if (editCustomerAddress !== order.customerAddress) changes.push('address');
    if (editNotes !== order.notes) changes.push('notes');
    if (editStatus !== order.status) changes.push('status');
    if (editDiscount !== order.discount.toString()) changes.push('discount');
    if (JSON.stringify(normalizedItems) !== JSON.stringify(order.items)) changes.push('items');

    if (changes.length === 0) {
      setShowEditModal(false);
      return;
    }

    const changeDescription = `Updated: ${changes.join(', ')}`;

    try {
      setIsSavingEdit(true);
      setEditItems(normalizedItems);
      setEditingItemPriceId(null);
      setEditingItemPriceValue('');

      await updateOrder(
        order.id,
        {
          customerName: editCustomerName,
          customerPhone: editCustomerPhone,
          customerEmail: editCustomerEmail,
          customerAddress: editCustomerAddress,
          notes: editNotes,
          status: editStatus,
          items: normalizedItems,
          subtotal,
          tax,
          discount,
          total,
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
    } catch (error) {
      console.error('[Order] Failed to save edits:', error);
      setAlertConfig({
        visible: true,
        title: 'Save Failed',
        message: 'Could not save order edits. Check connection and try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setIsSavingEdit(false);
    }
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
    setEditQuantityDrafts(prev => ({ ...prev, [itemId]: `${newQuantity}` }));
  };

  const commitItemQuantityDraft = (itemId: string) => {
    const item = editItems.find(i => i.id === itemId);
    if (!item) return;

    const raw = (editQuantityDrafts[itemId] ?? `${item.quantity}`).trim();
    if (!raw) {
      setEditQuantityDrafts(prev => ({ ...prev, [itemId]: `${item.quantity}` }));
      return;
    }

    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setEditQuantityDrafts(prev => ({ ...prev, [itemId]: `${item.quantity}` }));
      return;
    }

    updateItemQuantity(itemId, parsed);
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
    setEditQuantityDrafts(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const startEditItemPrice = (itemId: string, currentPrice: number) => {
    setEditingItemPriceId(itemId);
    setEditingItemPriceValue(currentPrice.toString());
  };

  const saveEditItemPrice = () => {
    if (!editingItemPriceId) return;

    const newPrice = parseFloat(editingItemPriceValue);
    if (!isNaN(newPrice) && newPrice >= 0) {
      setEditItems(prev => prev.map(item => {
        if (item.id === editingItemPriceId) {
          return {
            ...item,
            unitPrice: newPrice,
            totalPrice: newPrice * item.quantity,
          };
        }
        return item;
      }));
    }
    setEditingItemPriceId(null);
    setEditingItemPriceValue('');
    Haptics.selectionAsync();
  };

  const cancelEditItemPrice = () => {
    setEditingItemPriceId(null);
    setEditingItemPriceValue('');
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
          <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit} disabled={isSavingEdit}>
            {isSavingEdit ? (
              <RefreshCw size={24} color={Colors.light.primary} />
            ) : (
              <Check size={24} color={Colors.light.primary} />
            )}
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
            <View style={styles.editItemsHeader}>
              <Text style={styles.editSectionTitle}>Order Items</Text>
              <TouchableOpacity style={styles.addItemButton} onPress={() => setShowAddItemModal(true)}>
                <Plus size={14} color={Colors.light.primaryForeground} />
                <Text style={styles.addItemButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
            {editItems.map((item) => (
              <View key={item.id} style={styles.editItemCard}>
                <Image
                  source={{ uri: resolveImageUri(item.productImage) || item.productImage }}
                  style={styles.editItemImage}
                  contentFit="cover"
                />
                <View style={styles.editItemInfo}>
                  <Text style={styles.editItemName} numberOfLines={1}>{item.productName}</Text>
                  <Text style={styles.editItemSku} numberOfLines={1}>
                    SKU: {item.productSku || 'N/A'}
                  </Text>
                  {item.selectedVariations.length > 0 && (
                    <Text style={styles.editItemVariations} numberOfLines={2}>
                      {formatSelectedVariations(item.selectedVariations)}
                    </Text>
                  )}
                  {editingItemPriceId === item.id ? (
                    <View style={styles.priceEditRow}>
                      <View style={styles.priceInputRow}>
                        <Text style={styles.priceCurrencySmall}>R</Text>
                        <TextInput
                          style={styles.priceInputSmall}
                          value={editingItemPriceValue}
                          onChangeText={setEditingItemPriceValue}
                          keyboardType="decimal-pad"
                          autoFocus
                          selectTextOnFocus
                        />
                      </View>
                      <TouchableOpacity style={styles.priceEditBtnSmall} onPress={saveEditItemPrice}>
                        <Check size={14} color={Colors.light.success} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.priceEditBtnSmall} onPress={cancelEditItemPrice}>
                        <X size={14} color={Colors.light.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.editItemPriceTouchable}
                      onPress={() => startEditItemPrice(item.id, item.unitPrice)}
                    >
                      <Text style={styles.editItemPrice}>R{item.unitPrice.toFixed(2)} each</Text>
                      <Edit3 size={12} color={Colors.light.textTertiary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                  <View style={styles.editItemActions}>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => updateItemQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={14} color={Colors.light.text} />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInput}
                        value={editQuantityDrafts[item.id] ?? `${item.quantity}`}
                        onChangeText={(text) => {
                          const numeric = text.replace(/[^0-9]/g, '');
                          setEditQuantityDrafts(prev => ({ ...prev, [item.id]: numeric }));
                        }}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onBlur={() => commitItemQuantityDraft(item.id)}
                        onSubmitEditing={() => commitItemQuantityDraft(item.id)}
                        selectTextOnFocus
                      />
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

          <View style={styles.editSection}>
            <TouchableOpacity
              style={styles.deleteOrderBtn}
              onPress={() => {
                setAlertConfig({
                  visible: true,
                  title: 'Delete Order',
                  message: 'Are you sure you want to delete this order? This action cannot be undone.',
                  type: 'warning',
                  buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteOrder(id);
                          setShowEditModal(false);
                          router.back();
                        } catch (error) {
                          console.error('Failed to delete order:', error);
                        }
                      },
                    },
                  ],
                });
              }}
            >
              <Trash2 size={18} color="#fff" />
              <Text style={styles.deleteOrderBtnText}>Delete Order</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        <Modal
          visible={showAddItemModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddItemModal(false)}
        >
          <SafeAreaView style={styles.addItemModalContainer} edges={['top', 'bottom']}>
            <View style={styles.addItemModalHeader}>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAddItemModal(false)}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Product</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.addItemSearchContainer}>
              <TextInput
                style={styles.addItemSearchInput}
                value={addItemSearch}
                onChangeText={setAddItemSearch}
                placeholder="Search by product name, SKU, or variation"
                placeholderTextColor={Colors.light.textTertiary}
                autoCapitalize="none"
              />
            </View>

            <FlatList
              data={filteredProductsForAdd}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.addItemListContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.addItemRow}
                  onPress={() => addProductToEditItems(item)}
                >
                  <Image
                    source={{ uri: resolveImageUri(item.images[0]) || item.images[0] }}
                    style={styles.addItemImage}
                    contentFit="cover"
                  />
                  <View style={styles.addItemInfo}>
                    <Text style={styles.addItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.addItemSku} numberOfLines={1}>SKU: {item.sku || 'N/A'}</Text>
                    {item.variations.length > 0 && (
                      <Text style={styles.addItemVariations} numberOfLines={2}>
                        {getDefaultVariationSummary(item)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.addItemPrice}>R{item.basePrice.toFixed(2)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.addItemEmpty}>
                  <Text style={styles.addItemEmptyText}>No products found</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>
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
          {canEdit && (
            <TouchableOpacity
              style={[styles.headerBtn, isUpToDate && { opacity: 0.3 }]}
              onPress={() => !isUpToDate && syncOrderToEcwid(order.id)}
              disabled={!!isUpToDate}
            >
              <CloudUpload size={20} color={isSynced ? (isUpToDate ? Colors.light.success : Colors.light.warning) : Colors.light.primary} />
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
          {isSynced && (
            <Badge
              label={isUpToDate ? "Synced" : "Unsynced Changes"}
              variant={isUpToDate ? "success" : "warning"}
              style={{ marginLeft: 8 }}
            />
          )}
          {!isSynced && (
            <Badge
              label="Not Synced"
              variant="default"
              style={{ marginLeft: 8, backgroundColor: Colors.light.border }}
            />
          )}
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
                  source={{ uri: resolveImageUri(item.productImage) || item.productImage }}
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

            {/* Sync Logic for Body Buttons */}
            {isSynced ? (
              <TouchableOpacity
                style={[
                  styles.syncButton,
                  { marginTop: 12, opacity: isUpToDate ? 0.6 : 1 }
                ]}
                onPress={() => !isUpToDate && syncOrderToEcwid(order.id)}
                disabled={isUpToDate}
              >
                {isUpToDate ? (
                  <Check size={16} color={Colors.light.success} />
                ) : (
                  <RefreshCw size={16} color={Colors.light.primary} />
                )}
                <Text style={[styles.syncButtonText, isUpToDate && { color: Colors.light.success }]}>
                  {isUpToDate ? "Synced with Ecwid" : "Push Changes to Ecwid"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.syncButton, { marginTop: 12, backgroundColor: Colors.light.primary }]}
                onPress={() => syncOrderToEcwid(order.id)}
              >
                <CloudUpload size={16} color="#fff" />
                <Text style={[styles.syncButtonText, { color: '#fff' }]}>Push to Ecwid</Text>
              </TouchableOpacity>
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
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.primary,
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
  editItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addItemButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  editItemSku: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 1,
  },
  editItemVariations: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  editItemPrice: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  editItemPriceTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  priceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceCurrencySmall: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  priceInputSmall: {
    fontSize: 12,
    color: Colors.light.text,
    minWidth: 50,
    padding: 0,
  },
  priceEditBtnSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
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
  qtyInput: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    minWidth: 42,
    textAlign: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
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
  deleteOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.danger,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  deleteOrderBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  addItemModalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  addItemModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  addItemSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  addItemSearchInput: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
  },
  addItemListContent: {
    padding: 16,
    gap: 10,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  addItemImage: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  addItemInfo: {
    flex: 1,
  },
  addItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  addItemSku: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  addItemVariations: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  addItemPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  addItemEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  addItemEmptyText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
});
