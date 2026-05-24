import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Minus, Plus, ShoppingCart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ProductVariation, SelectedVariation } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useData } from '@/contexts/DataContext';
import {
  calculateProductUnitPrice,
  getEffectiveMoq,
  getSelectedVariationsFromOptionIds
} from '@/lib/product-pricing';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

export default function ShopProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem, items } = useCart();
  const { getProductById, resolveImageUri, isSyncing } = useData();
  const product = useMemo(() => {
    return id ? getProductById(id) ?? null : null;
  }, [getProductById, id]);

  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) return;
    const initialSelections: Record<string, string> = {};
    product.variations.forEach((variation) => {
      if (variation.options[0]) initialSelections[variation.id] = variation.options[0].id;
    });
    setSelectedVariations(initialSelections);
  }, [product]);

  const effectiveMoq = useMemo(() => {
    if (!product) return 1;
    return getEffectiveMoq(product, getSelectedVariationsFromOptionIds(product, selectedVariations));
  }, [product, selectedVariations]);

  useEffect(() => {
    if (quantity < effectiveMoq) setQuantity(effectiveMoq);
  }, [effectiveMoq, quantity]);

  const price = useMemo(() => {
    if (!product) return 0;
    return calculateProductUnitPrice(
      product,
      getSelectedVariationsFromOptionIds(product, selectedVariations)
    );
  }, [product, selectedVariations]);

  const totalInCart = useMemo(() => {
    if (!product) return 0;
    return items.filter((item) => item.product.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
  }, [items, product]);

  const displayImage = resolveImageUri(product?.images?.[0]) || product?.images?.[0];

  const handleAddToCart = () => {
    if (!product) return;
    const selected: SelectedVariation[] = getSelectedVariationsFromOptionIds(product, selectedVariations);

    addItem(product, selected, quantity);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const renderVariation = (variation: ProductVariation) => {
    const selectedOptionId = selectedVariations[variation.id];
    return (
      <View key={variation.id} style={styles.section}>
        <Text style={styles.sectionTitle}>{variation.name}</Text>
        <View style={styles.optionWrap}>
          {variation.options.map((option) => {
            const active = selectedOptionId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionChip, active && styles.optionChipActive]}
                onPress={() => {
                  setSelectedVariations((current) => ({ ...current, [variation.id]: option.id }));
                  Haptics.selectionAsync();
                }}
              >
                <View>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.name}</Text>
                </View>
                {active ? <Check size={14} color={Colors.light.primaryForeground} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (!product && (isSyncing || !id)) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.light.primary} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Product not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={Colors.light.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/(shop)/cart' as any)}>
          <ShoppingCart size={20} color={Colors.light.text} />
          {totalInCart > 0 ? <Text style={styles.cartCount}>{totalInCart}</Text> : null}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageWrap}>
          {displayImage ? (
            <Image source={{ uri: displayImage }} style={styles.image} contentFit="contain" />
          ) : (
            <ShoppingCart size={48} color={Colors.light.textTertiary} />
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.sku}>SKU: {product.sku}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>R{price.toFixed(2)}</Text>
            {product.moq ? <Text style={styles.moq}>MOQ {product.moq}</Text> : null}
          </View>
          {product.variations.map(renderVariation)}
          <Text style={styles.description}>{product.description}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepButton, quantity <= effectiveMoq && styles.stepButtonDisabled]}
              disabled={quantity <= effectiveMoq}
              onPress={() => setQuantity((current) => Math.max(effectiveMoq, current - effectiveMoq))}
            >
              <Minus size={18} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => setQuantity((current) => current + effectiveMoq)}
            >
              <Plus size={18} color={Colors.light.text} />
            </TouchableOpacity>
          </View>
        </View>
        <Button
          title={`Add to cart • R${(price * quantity).toFixed(2)}`}
          onPress={handleAddToCart}
          fullWidth
          size="lg"
          icon={<ShoppingCart size={20} color={Colors.light.primaryForeground} />}
        />
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cartButton: {
    minWidth: 42,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: Colors.light.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cartCount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  imageWrap: {
    height: 320,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  sku: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  price: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  moq: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    marginTop: 16,
    marginBottom: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  optionChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  optionTextActive: {
    color: Colors.light.primaryForeground,
  },
  optionPriceText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quantityLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.45,
  },
  quantityValue: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: Colors.light.textSecondary,
  },
});
