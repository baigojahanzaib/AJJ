import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import Colors from '@/constants/colors';
import { Product } from '@/types';
import Badge from './Badge';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  variant?: 'grid' | 'list';
}

export default function ProductCard({ product, onPress, variant = 'grid' }: ProductCardProps) {
  const formatPrice = (price: number) => {
    return `R${price.toFixed(2)}`;
  };

  const getDiscountPercentage = (base: number, compare: number) => {
    if (!compare || compare <= base) return null;
    return Math.round(((compare - base) / compare) * 100);
  };


  if (variant === 'list') {
    return (
      <TouchableOpacity style={styles.listContainer} onPress={onPress} activeOpacity={0.7}>
        <Image
          source={{ uri: product.images[0] }}
          style={styles.listImage}
          contentFit="cover"
        />
        <View style={styles.listContent}>
          <Text style={styles.listName} numberOfLines={2}>{product.name}</Text>
          <View style={styles.skuPriceRow}>
            <Text style={styles.sku}>{product.sku}</Text>
            <Text style={styles.price}>{formatPrice(product.basePrice)}</Text>
          </View>
          <View style={styles.listFooter}>
            {product.variations.length > 0 && (
              <Badge label={`${product.variations.length} options`} size="sm" />
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
          contentFit="cover"
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

      </View>
      <View style={styles.gridContent}>
        <Text style={styles.gridName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.sku}>{product.sku}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.basePrice)}</Text>
          {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
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
    backgroundColor: Colors.light.surfaceSecondary,
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
    minHeight: 120, // Added minHeight
  },
  listImage: {
    width: 100,
    height: '100%', // Changed to 100% to fill container
    backgroundColor: Colors.light.surfaceSecondary,
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
    marginTop: 4, // Adjusted top margin
  },
});
