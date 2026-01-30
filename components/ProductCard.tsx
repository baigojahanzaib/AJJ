import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { Product } from '@/types';
import Badge from './Badge';

import { useCart } from '@/contexts/CartContext';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  variant?: 'grid' | 'list';
}

export default function ProductCard({ product, onPress, variant = 'grid' }: ProductCardProps) {
  const { items } = useCart();

  const cartQuantity = items
    .filter(item => item.product.id === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  const formatPrice = (price: number) => {
    return `R${price.toFixed(2)}`;
  };

  const getDiscountPercentage = (base: number, compare: number) => {
    if (!compare || compare <= base) return null;
    return Math.round(((compare - base) / compare) * 100);
  };


  const getPriceRange = () => {
    if (product.combinations && product.combinations.length > 0) {
      const prices = product.combinations.map(c => c.price).filter(p => p > 0);
      if (prices.length > 0) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return { min, max, hasRange: max > min };
      }
    }

    let min = product.basePrice;
    let max = product.basePrice;

    if (product.variations.length > 0) {
      // Basic modifier calculation for min/max
      product.variations.forEach(v => {
        const modifiers = v.options.map(o => o.priceModifier);
        const minMod = Math.min(...modifiers);
        const maxMod = Math.max(...modifiers);
        min += minMod;
        max += maxMod;
      });
    }

    return { min, max, hasRange: max > min };
  };

  const { min, max, hasRange } = getPriceRange();

  if (variant === 'list') {
    return (
      <TouchableOpacity style={styles.listContainer} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.listImageWrapper}>
          <Image
            source={{ uri: product.images[0] }}
            style={styles.listImage}
            contentFit="contain"
          />
        </View>
        <View style={styles.listContent}>
          <Text style={styles.listName} numberOfLines={2}>{product.name}</Text>
          <View style={styles.skuPriceRow}>
            <Text style={styles.sku}>{product.sku}</Text>
            <Text style={styles.price}>
              {hasRange ? `From ${formatPrice(min)}` : formatPrice(product.basePrice)}
            </Text>
          </View>
          <View style={styles.listFooter}>
            {product.variations.length > 0 && (
              <Badge label={`${product.variations.length} options`} size="sm" />
            )}
            {cartQuantity > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartQuantity} in cart</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.gridContainer} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.images[0] }}
          style={styles.gridImage}
          contentFit="contain"
        />

        {/* Top Left Badges: Inactive, Sale, New, Ribbon */}
        <View style={styles.topLeftBadges}>
          {!product.isActive && (
            <View style={[styles.badge, styles.badgeInactive]}>
              <Text style={styles.badgeText}>Inactive</Text>
            </View>
          )}
          {product.isActive && product.compareAtPrice && product.compareAtPrice > product.basePrice && (
            <View style={[styles.badge, styles.badgeSale]}>
              <Text style={styles.badgeText}>
                {getDiscountPercentage(product.basePrice, product.compareAtPrice)}% OFF
              </Text>
            </View>
          )}
          {product.isActive && product.ribbon && (
            <View style={[
              styles.badge,
              { backgroundColor: product.ribbonColor || '#FF6B00' }
            ]}>
              <Text style={styles.badgeText}>{product.ribbon}</Text>
            </View>
          )}
        </View>

        {/* Cart Quantity Badge - Bottom Right of Image */}
        {cartQuantity > 0 && (
          <View style={styles.gridCartBadge}>
            <Text style={styles.gridCartBadgeText}>{cartQuantity} in cart</Text>
          </View>
        )}

      </View>
      <View style={styles.gridContent}>
        <Text style={styles.gridName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.sku}>{product.sku}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {hasRange ? `From ${formatPrice(min)}` : formatPrice(product.basePrice)}
          </Text>
          {product.compareAtPrice && product.compareAtPrice > product.basePrice && !hasRange && (
            <Text style={styles.oldPrice}>{formatPrice(product.compareAtPrice)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fff',
  },
  topLeftBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeInactive: {
    backgroundColor: Colors.light.danger,
  },
  badgeSale: {
    backgroundColor: Colors.light.primary,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gridContent: {
    padding: 12,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  sku: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  oldPrice: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textDecorationLine: 'line-through',
  },
  moqText: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  listContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    height: 110, // Fixed height to prevent stretching
  },
  listImageWrapper: {
    width: 110, // Increased as requested
    height: 110, // Matching parent height
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  listImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  listContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
  },
  listName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  skuPriceRow: { // Added
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // Gap between SKU and Price
    marginBottom: 4,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cartBadge: {
    backgroundColor: Colors.light.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  gridCartBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: Colors.light.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gridCartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
