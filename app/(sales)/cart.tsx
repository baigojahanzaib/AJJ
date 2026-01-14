import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, FlatList, TextInput, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Minus, Plus, Trash2, ShoppingBag, CheckCircle, UserPlus, Search, X, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCart } from '@/contexts/CartContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Colors from '@/constants/colors';
import { getActiveCustomers } from '@/mocks/customers';
import { Customer } from '@/types';
import ThemedAlert from '@/components/ThemedAlert';

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
}

type CustomerModalStep = 'list' | 'create' | 'confirm';

export default function SalesCart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, customerInfo, notes, subtotal, tax, total, itemCount, setCustomerInfo, setNotes, updateQuantity, removeItem, clearCart } = useCart();
  const { addOrder } = useData();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalStep, setCustomerModalStep] = useState<CustomerModalStep>('list');
  const [customerSearch, setCustomerSearch] = useState('');
  const [, setSelectedCustomer] = useState<Customer | null>(null);
  const [tempCustomerInfo, setTempCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [confirmedCustomer, setConfirmedCustomer] = useState<{
    name: string;
    phone: string;
    email: string;
    address: string;
  } | null>(null);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (config: Omit<AlertConfig, 'visible'>) => {
    setAlertConfig({ ...config, visible: true });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const activeCustomers = useMemo(() => getActiveCustomers(), []);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return activeCustomers;
    const search = customerSearch.toLowerCase();
    return activeCustomers.filter(
      customer =>
        customer.name.toLowerCase().includes(search) ||
        customer.company?.toLowerCase().includes(search) ||
        customer.phone.includes(search) ||
        customer.email.toLowerCase().includes(search)
    );
  }, [activeCustomers, customerSearch]);

  const handleOpenCustomerModal = () => {
    if (items.length === 0) {
      showAlert({
        title: 'Empty Cart',
        message: 'Please add items to your cart before submitting an order.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    setCustomerModalStep('list');
    setCustomerSearch('');
    setShowCustomerModal(true);
    Haptics.selectionAsync();
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setConfirmedCustomer({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    });
    setCustomerInfo({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    });
    Haptics.selectionAsync();
    setCustomerModalStep('confirm');
  };

  const handleOpenCreateCustomer = () => {
    setTempCustomerInfo({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
    setCustomerModalStep('create');
    Haptics.selectionAsync();
  };

  const handleSaveAndSelectNewCustomer = () => {
    if (!tempCustomerInfo.name.trim() || !tempCustomerInfo.phone.trim()) {
      showAlert({
        title: 'Missing Information',
        message: 'Please fill in customer name and phone number.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    
    setCustomerInfo({
      name: tempCustomerInfo.name,
      phone: tempCustomerInfo.phone,
      email: tempCustomerInfo.email,
      address: tempCustomerInfo.address,
    });
    setConfirmedCustomer({
      name: tempCustomerInfo.name,
      phone: tempCustomerInfo.phone,
      email: tempCustomerInfo.email,
      address: tempCustomerInfo.address,
    });
    setSelectedCustomer(null);
    Haptics.selectionAsync();
    setCustomerModalStep('confirm');
  };

  const handleConfirmOrder = () => {
    if (!confirmedCustomer) return;
    handleSubmitOrder(null, confirmedCustomer);
  };

  const handleSubmitOrder = async (customer?: Customer | null, newCustomerData?: typeof tempCustomerInfo) => {
    const customerData = customer 
      ? { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address }
      : newCustomerData || customerInfo;

    if (!customerData.name.trim() || !customerData.phone.trim()) {
      showAlert({
        title: 'Missing Information',
        message: 'Please select a customer or create a new one.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = items.map(item => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        productSku: item.product.sku,
        productImage: item.product.images[0],
        selectedVariations: item.selectedVariations,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }));

      const newOrder = addOrder({
        salesRepId: user?.id || '',
        salesRepName: user?.name || '',
        customerName: customerData.name,
        customerPhone: customerData.phone,
        customerEmail: customerData.email,
        customerAddress: customerData.address,
        items: orderItems,
        subtotal,
        tax,
        discount: 0,
        total,
        status: 'pending',
        notes,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCustomerModal(false);
      
      showAlert({
        title: 'Order Submitted!',
        message: `Order ${newOrder.orderNumber} has been created successfully.`,
        type: 'success',
        buttons: [
          {
            text: 'View Orders',
            style: 'default',
            onPress: () => {
              clearCart();
              setSelectedCustomer(null);
              router.push('/(sales)/orders');
            },
          },
          {
            text: 'New Order',
            style: 'cancel',
            onPress: () => {
              clearCart();
              setSelectedCustomer(null);
            },
          },
        ],
      });
    } catch (error) {
      console.error('[Cart] Error submitting order:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to submit order. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCustomerListView = () => (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Select Customer</Text>
        <TouchableOpacity 
          style={styles.modalCloseButton}
          onPress={() => setShowCustomerModal(false)}
        >
          <X size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.createCustomerButton} 
        onPress={handleOpenCreateCustomer}
        activeOpacity={0.7}
      >
        <View style={styles.createCustomerIcon}>
          <UserPlus size={22} color={Colors.light.primaryForeground} />
        </View>
        <View style={styles.createCustomerContent}>
          <Text style={styles.createCustomerTitle}>Create New Customer</Text>
          <Text style={styles.createCustomerSubtitle}>Enter details manually</Text>
        </View>
        <ChevronRight size={20} color={Colors.light.textTertiary} />
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or select existing</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color={Colors.light.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor={Colors.light.textTertiary}
            value={customerSearch}
            onChangeText={setCustomerSearch}
            autoCapitalize="none"
          />
          {customerSearch.length > 0 && (
            <TouchableOpacity onPress={() => setCustomerSearch('')}>
              <X size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        style={styles.customerList}
        contentContainerStyle={styles.customerListContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.customerOption}
            onPress={() => handleSelectCustomer(item)}
            activeOpacity={0.7}
          >
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{item.name}</Text>
              {item.company && (
                <Text style={styles.customerCompany}>{item.company}</Text>
              )}
              <Text style={styles.customerPhone}>{item.phone}</Text>
            </View>
            <ChevronRight size={18} color={Colors.light.textTertiary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCustomers}>
            <Text style={styles.emptyCustomersText}>No customers found</Text>
          </View>
        }
      />
    </View>
  );

  const renderCreateCustomerView = () => (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCustomerModalStep('list')}
        >
          <X size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>New Customer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.createFormScroll} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Input
            label="Customer Name"
            placeholder="Enter customer name"
            value={tempCustomerInfo.name}
            onChangeText={(text) => setTempCustomerInfo({ ...tempCustomerInfo, name: text })}
            containerStyle={styles.inputContainer}
          />
          <Input
            label="Phone Number"
            placeholder="Enter phone number"
            value={tempCustomerInfo.phone}
            onChangeText={(text) => setTempCustomerInfo({ ...tempCustomerInfo, phone: text })}
            keyboardType="phone-pad"
            containerStyle={styles.inputContainer}
          />
          <Input
            label="Email (Optional)"
            placeholder="Enter email address"
            value={tempCustomerInfo.email}
            onChangeText={(text) => setTempCustomerInfo({ ...tempCustomerInfo, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            containerStyle={styles.inputContainer}
          />
          <Input
            label="Delivery Address (Optional)"
            placeholder="Enter delivery address"
            value={tempCustomerInfo.address}
            onChangeText={(text) => setTempCustomerInfo({ ...tempCustomerInfo, address: text })}
            multiline
            numberOfLines={2}
            containerStyle={styles.inputContainer}
          />
        </View>
      </ScrollView>

      <View style={[styles.createFormFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          title="Continue to Review"
          onPress={handleSaveAndSelectNewCustomer}
          fullWidth
          size="lg"
          icon={<ChevronRight size={20} color={Colors.light.primaryForeground} />}
        />
      </View>
    </View>
  );

  const renderConfirmationView = () => (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCustomerModalStep('list')}
        >
          <X size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Confirm Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.createFormScroll} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>Customer</Text>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmCustomerName}>{confirmedCustomer?.name}</Text>
            <Text style={styles.confirmCustomerDetail}>{confirmedCustomer?.phone}</Text>
            {confirmedCustomer?.email && (
              <Text style={styles.confirmCustomerDetail}>{confirmedCustomer?.email}</Text>
            )}
            {confirmedCustomer?.address && (
              <Text style={styles.confirmCustomerDetail}>{confirmedCustomer?.address}</Text>
            )}
          </View>
        </View>

        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>Order Items ({itemCount})</Text>
          <View style={styles.confirmCard}>
            {items.map((item, index) => (
              <View key={item.id} style={[styles.confirmItem, index > 0 && styles.confirmItemBorder]}>
                <Image
                  source={{ uri: item.product.images[0] }}
                  style={styles.confirmItemImage}
                  contentFit="cover"
                />
                <View style={styles.confirmItemInfo}>
                  <Text style={styles.confirmItemName} numberOfLines={1}>{item.product.name}</Text>
                  {item.selectedVariations.length > 0 && (
                    <Text style={styles.confirmItemVariations}>
                      {item.selectedVariations.map(v => v.optionName).join(' / ')}
                    </Text>
                  )}
                  <Text style={styles.confirmItemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.confirmItemPrice}>${item.totalPrice.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.confirmSection}>
          <Text style={styles.confirmSectionTitle}>Order Summary</Text>
          <View style={styles.confirmCard}>
            <View style={styles.confirmSummaryRow}>
              <Text style={styles.confirmSummaryLabel}>Subtotal</Text>
              <Text style={styles.confirmSummaryValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.confirmSummaryRow}>
              <Text style={styles.confirmSummaryLabel}>Tax (9%)</Text>
              <Text style={styles.confirmSummaryValue}>${tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.confirmSummaryRow, styles.confirmTotalRow]}>
              <Text style={styles.confirmTotalLabel}>Total</Text>
              <Text style={styles.confirmTotalValue}>${total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {notes && (
          <View style={styles.confirmSection}>
            <Text style={styles.confirmSectionTitle}>Notes</Text>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmNotes}>{notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <View style={[styles.createFormFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Button
          title="Confirm & Submit Order"
          onPress={handleConfirmOrder}
          loading={isSubmitting}
          fullWidth
          size="lg"
          icon={<CheckCircle size={20} color={Colors.light.primaryForeground} />}
        />
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <ShoppingBag size={64} color={Colors.light.textTertiary} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add products from the catalog to create an order</Text>
          <Button
            title="Browse Catalog"
            onPress={() => router.push('/(sales)/catalog')}
            style={styles.browseButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Cart</Text>
            <Text style={styles.itemCount}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              showAlert({
                title: 'Clear Cart',
                message: 'Remove all items?',
                type: 'warning',
                buttons: [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => {
                    clearCart();
                    setSelectedCustomer(null);
                  }},
                ],
              });
            }}
          >
            <Trash2 size={20} color={Colors.light.danger} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {items.map(item => (
              <Card key={item.id} style={styles.cartItem}>
                <View style={styles.itemRow}>
                  <Image
                    source={{ uri: item.product.images[0] }}
                    style={styles.itemImage}
                    contentFit="cover"
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
                    {item.selectedVariations.length > 0 && (
                      <Text style={styles.itemVariations}>
                        {item.selectedVariations.map(v => v.optionName).join(' / ')}
                      </Text>
                    )}
                    <Text style={styles.itemPrice}>${item.unitPrice.toFixed(2)} each</Text>
                  </View>
                </View>
                <View style={styles.itemActions}>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        updateQuantity(item.id, item.quantity - 1);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Minus size={16} color={Colors.light.text} />
                    </TouchableOpacity>
                    <Text style={styles.quantityValue}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => {
                        updateQuantity(item.id, item.quantity + 1);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Plus size={16} color={Colors.light.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.itemTotalContainer}>
                    <Text style={styles.itemTotal}>${item.totalPrice.toFixed(2)}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        removeItem(item.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                      }}
                    >
                      <Trash2 size={18} color={Colors.light.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <Card>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax (9%)</Text>
                <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <Input
              label="Order Notes (Optional)"
              placeholder="Add notes for this order..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>
        </ScrollView>

        <View style={styles.stickyFooter}>
          <Button
            title="Submit Order"
            onPress={handleOpenCustomerModal}
            loading={isSubmitting}
            fullWidth
            size="lg"
            icon={<CheckCircle size={20} color={Colors.light.primaryForeground} />}
          />
        </View>

        <Modal
          visible={showCustomerModal}
          animationType="slide"
          presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
          onRequestClose={() => setShowCustomerModal(false)}
        >
          <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
            {customerModalStep === 'list' && renderCustomerListView()}
            {customerModalStep === 'create' && renderCreateCustomerView()}
            {customerModalStep === 'confirm' && renderConfirmationView()}
          </View>
        </Modal>
      </KeyboardAvoidingView>

      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardView: {
    flex: 1,
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
  itemCount: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  browseButton: {
    marginTop: 24,
  },
  section: {
    paddingHorizontal: 20,
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
  cartItem: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  itemVariations: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    minWidth: 24,
    textAlign: 'center',
  },
  itemTotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.light.background,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    flex: 1,
    textAlign: 'center',
  },
  modalCloseButton: {
    padding: 4,
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  backButton: {
    padding: 4,
  },
  createCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  createCustomerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  createCustomerContent: {
    flex: 1,
  },
  createCustomerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  createCustomerSubtitle: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.borderLight,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    paddingHorizontal: 12,
  },
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    height: '100%',
  },
  customerList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  customerListContent: {
    paddingBottom: 20,
  },
  customerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  customerCompany: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  emptyCustomers: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCustomersText: {
    fontSize: 15,
    color: Colors.light.textTertiary,
  },
  createFormScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  createFormFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  confirmSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  confirmSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  confirmCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  confirmCustomerName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  confirmCustomerDetail: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  confirmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  confirmItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  confirmItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  confirmItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  confirmItemVariations: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  confirmItemQty: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  confirmItemPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  confirmSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmSummaryLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  confirmSummaryValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  confirmTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    marginTop: 8,
    paddingTop: 14,
  },
  confirmTotalLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  confirmTotalValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  confirmNotes: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 20,
  },
});
