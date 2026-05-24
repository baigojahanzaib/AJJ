import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { useData } from '@/contexts/DataContext';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Colors from '@/constants/colors';

export default function ShopCartScreen() {
  const router = useRouter();
  const { items, subtotal, tax, total, updateQuantity, removeItem, clearCart } = useCart();
  const { resolveImageUri } = useData();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <ShoppingBag size={64} color={Colors.light.textTertiary} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse products and add items when you are ready.</Text>
          <Button title="Browse Products" onPress={() => router.push('/(shop)/catalog' as any)} style={styles.emptyButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Cart</Text>
          <Text style={styles.count}>{items.length} line item{items.length === 1 ? '' : 's'}</Text>
        </View>
        <TouchableOpacity onPress={clearCart} style={styles.clearButton}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const imageUri = resolveImageUri(item.product.images?.[0]) || item.product.images?.[0];
          return (
            <Card style={styles.itemCard}>
              <View style={styles.itemTop}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.itemImage} contentFit="contain" />
                ) : (
                  <View style={styles.itemImage} />
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.product.name}</Text>
                  {item.selectedVariations.length > 0 ? (
                    <Text style={styles.itemMeta} numberOfLines={2}>
                      {item.selectedVariations.map((variation) => variation.optionName).join(' / ')}
                    </Text>
                  ) : null}
                  <Text style={styles.itemPrice}>R{item.unitPrice.toFixed(2)} each</Text>
                </View>
              </View>
              <View style={styles.itemActions}>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => {
                      if (item.quantity <= 1) {
                        removeItem(item.id);
                        return;
                      }
                      updateQuantity(item.id, item.quantity - 1);
                    }}
                  >
                    <Minus size={16} color={Colors.light.text} />
                  </TouchableOpacity>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepButton}
                    onPress={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus size={16} color={Colors.light.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.totalWrap}>
                  <Text style={styles.lineTotal}>R{item.totalPrice.toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Trash2 size={18} color={Colors.light.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        }}
        ListFooterComponent={
          <Card style={styles.summaryCard}>
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
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Button title="Continue Shopping" onPress={() => router.push('/(shop)/catalog' as any)} variant="secondary" fullWidth />
        <Button title="Checkout" onPress={() => router.push('/(shop)/checkout' as any)} fullWidth size="lg" />
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.danger,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  itemCard: {
    gap: 14,
  },
  itemTop: {
    flexDirection: 'row',
    gap: 12,
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  itemMeta: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  totalWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  summaryCard: {
    marginTop: 8,
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
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 18,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
  },
});
