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
    return `$${price.toFixed(2)}`;
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
          <Text style={styles.sku}>{product.sku}</Text>
          <View style={styles.listFooter}>
            <Text style={styles.price}>{formatPrice(product.basePrice)}</Text>
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
        {!product.isActive && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveText}>Inactive</Text>
          </View>
        )}
      </View>
      <View style={styles.gridContent}>
        <Text style={styles.gridName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.sku}>{product.sku}</Text>
        <Text style={styles.price}>{formatPrice(product.basePrice)}</Text>
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
  inactiveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.light.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inactiveText: {
    color: Colors.light.primaryForeground,
    fontSize: 11,
    fontWeight: '600' as const,
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
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
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
  },
  listImage: {
    width: 100,
    height: 100,
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
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
