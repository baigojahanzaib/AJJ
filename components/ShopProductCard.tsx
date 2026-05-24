import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { ShoppingCart } from 'lucide-react-native';
import { Product } from '@/types';
import { useData } from '@/contexts/DataContext';
import { getStartingPrice } from '@/lib/product-pricing';
import Colors from '@/constants/colors';

type ShopProductCardProps = {
  product: Product;
  onPress: () => void;
};

const formatPrice = (value: number) => `R${value.toFixed(2)}`;

export default function ShopProductCard({ product, onPress }: ShopProductCardProps) {
  const { resolveImageUri } = useData();
  const productImageUri = resolveImageUri(product.images?.[0]) || product.images?.[0];
  const startingPrice = getStartingPrice(product);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.imageWrap}>
        {productImageUri ? (
          <Image source={{ uri: productImageUri }} style={styles.image} contentFit="contain" />
        ) : (
          <ShoppingCart size={32} color={Colors.light.textTertiary} />
        )}
        {product.ribbon ? (
          <View style={[styles.ribbon, { backgroundColor: product.ribbonColor || Colors.light.primary }]}>
            <Text style={styles.ribbonText}>{product.ribbon}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {product.sku}{product.moq ? ` • MOQ ${product.moq}` : ''}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatPrice(startingPrice)}</Text>
          <View style={styles.addHint}>
            <ShoppingCart size={14} color={Colors.light.primaryForeground} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  imageWrap: {
    height: 150,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ribbon: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ribbonText: {
    color: Colors.light.primaryForeground,
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
  },
  body: {
    padding: 12,
    gap: 6,
  },
  name: {
    minHeight: 40,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  addHint: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
