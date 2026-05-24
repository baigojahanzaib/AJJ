import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle, MapPin, Mail, Phone, User } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useData } from '@/contexts/DataContext';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';
import { buildOrderItemsFromCartItems } from '@/lib/order-items';

export default function ShopCheckoutScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const {
    items,
    customerInfo,
    notes,
    subtotal,
    tax,
    total,
    setCustomerInfo,
    setNotes,
    clearCart,
  } = useCart();
  const { addOrder } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/sign-in' as any);
      return;
    }

    if (user && !customerInfo.name && !customerInfo.email && !customerInfo.phone) {
      setCustomerInfo({
        ...customerInfo,
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    }
  }, [customerInfo, isAuthenticated, router, setCustomerInfo, user]);

  const showAlert = (config: Omit<typeof alertConfig, 'visible'>) => {
    setAlertConfig({ ...config, visible: true });
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      showAlert({
        title: 'Empty Cart',
        message: 'Add at least one product before placing an order.',
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    if (!customerInfo.name.trim() || !customerInfo.phone.trim() || !customerInfo.email.trim() || !customerInfo.address.trim()) {
      showAlert({
        title: 'Missing Details',
        message: 'Please complete your contact and delivery details.',
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const orderItems = buildOrderItemsFromCartItems(items);

      const newOrder = await addOrder({
        salesRepId: '',
        salesRepName: 'Client Shop',
        orderSource: 'client_shop',
        clientUserId: user?.id,
        placedByUserId: user?.id,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        customerAddress: customerInfo.address,
        latitude: customerInfo.latitude,
        longitude: customerInfo.longitude,
        items: orderItems,
        subtotal,
        tax,
        discount: 0,
        total,
        status: 'placed',
        notes,
      });

      clearCart();
      showAlert({
        title: 'Order placed',
        message: `Order ${newOrder.orderNumber} has been submitted.`,
        type: 'success',
        buttons: [
          {
            text: 'View Orders',
            onPress: () => router.replace('/(shop)/orders' as any),
          },
        ],
      });
    } catch (error) {
      console.error('[ShopCheckout] Order submission failed:', error);
      showAlert({
        title: 'Order Failed',
        message: 'Could not place your order. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Checkout</Text>
            <Text style={styles.subtitle}>Confirm delivery details and place your order.</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            <Input
              label="Name"
              value={customerInfo.name}
              onChangeText={(name) => setCustomerInfo({ ...customerInfo, name })}
              placeholder="Contact name"
              leftIcon={<User size={20} color={Colors.light.textTertiary} />}
            />
            <Input
              label="Phone"
              value={customerInfo.phone}
              onChangeText={(phone) => setCustomerInfo({ ...customerInfo, phone })}
              placeholder="Phone number"
              keyboardType="phone-pad"
              leftIcon={<Phone size={20} color={Colors.light.textTertiary} />}
            />
            <Input
              label="Email"
              value={customerInfo.email}
              onChangeText={(email) => setCustomerInfo({ ...customerInfo, email })}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon={<Mail size={20} color={Colors.light.textTertiary} />}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery</Text>
            <Input
              label="Address"
              value={customerInfo.address}
              onChangeText={(address) => setCustomerInfo({ ...customerInfo, address })}
              placeholder="Delivery address"
              multiline
              leftIcon={<MapPin size={20} color={Colors.light.textTertiary} />}
            />
            <Input
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Special instructions"
              multiline
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items</Text>
              <Text style={styles.summaryValue}>{items.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>R{subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>R{tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R{total.toFixed(2)}</Text>
            </View>
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Place Order"
            onPress={handlePlaceOrder}
            loading={isSubmitting}
            disabled={items.length === 0}
            fullWidth
            size="lg"
            icon={<CheckCircle size={20} color={Colors.light.primaryForeground} />}
          />
        </View>
      </KeyboardAvoidingView>

      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig((current) => ({ ...current, visible: false }))}
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
  content: {
    padding: 20,
    gap: 14,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  card: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    marginTop: 8,
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
});
