import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { X, Minus, Plus, ShoppingCart, Check, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useData } from '@/contexts/DataContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import Colors from '@/constants/colors';
import { Product, SelectedVariation, ProductVariation } from '@/types';

export default function SalesCatalog() {
  const { activeProducts, activeCategories, getCategoryById } = useData();
  const { addItem } = useCart();
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeProducts, searchQuery, selectedCategory]);

  const openProductModal = (product: Product) => {
    const index = filteredProducts.findIndex(p => p.id === product.id);
    setCurrentProductIndex(index >= 0 ? index : 0);
    setSelectedProduct(product);
    setSelectedVariations({});
    setQuantity(1);
    
    if (product.variations.length > 0) {
      const initialVariations: Record<string, string> = {};
      product.variations.forEach(variation => {
        if (variation.options.length > 0) {
          initialVariations[variation.id] = variation.options[0].id;
        }
      });
      setSelectedVariations(initialVariations);
    }
  };

  const navigateToProduct = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? currentProductIndex - 1 
      : currentProductIndex + 1;
    
    if (newIndex >= 0 && newIndex < filteredProducts.length) {
      const newProduct = filteredProducts[newIndex];
      setCurrentProductIndex(newIndex);
      setSelectedProduct(newProduct);
      setSelectedVariations({});
      setQuantity(1);
      
      if (newProduct.variations.length > 0) {
        const initialVariations: Record<string, string> = {};
        newProduct.variations.forEach(variation => {
          if (variation.options.length > 0) {
            initialVariations[variation.id] = variation.options[0].id;
          }
        });
        setSelectedVariations(initialVariations);
      }
      Haptics.selectionAsync();
    }
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
    setSelectedVariations({});
    setQuantity(1);
  };

  const calculatePrice = (): number => {
    if (!selectedProduct) return 0;
    
    let price = selectedProduct.basePrice;
    
    selectedProduct.variations.forEach(variation => {
      const selectedOptionId = selectedVariations[variation.id];
      const option = variation.options.find(opt => opt.id === selectedOptionId);
      if (option) {
        price += option.priceModifier;
      }
    });
    
    return price;
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const variationsArray: SelectedVariation[] = selectedProduct.variations.map(variation => {
      const selectedOptionId = selectedVariations[variation.id];
      const option = variation.options.find(opt => opt.id === selectedOptionId);
      return {
        variationId: variation.id,
        variationName: variation.name,
        optionId: option?.id || '',
        optionName: option?.name || '',
        priceModifier: option?.priceModifier || 0,
      };
    });

    addItem(selectedProduct, variationsArray, quantity);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeProductModal();
  };

  const renderVariationSelector = (variation: ProductVariation) => {
    const selectedOptionId = selectedVariations[variation.id];

    return (
      <View key={variation.id} style={styles.variationContainer}>
        <Text style={styles.variationLabel}>{variation.name}</Text>
        <View style={styles.optionsContainer}>
          {variation.options.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionChip,
                selectedOptionId === option.id && styles.optionChipSelected,
              ]}
              onPress={() => {
                setSelectedVariations(prev => ({
                  ...prev,
                  [variation.id]: option.id,
                }));
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedOptionId === option.id && styles.optionTextSelected,
                ]}
              >
                {option.name}
              </Text>
              {option.priceModifier !== 0 && (
                <Text
                  style={[
                    styles.optionPrice,
                    selectedOptionId === option.id && styles.optionPriceSelected,
                  ]}
                >
                  {option.priceModifier > 0 ? '+' : ''}${option.priceModifier.toFixed(2)}
                </Text>
              )}
              {selectedOptionId === option.id && (
                <Check size={14} color={Colors.light.primaryForeground} style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'Sales Rep'}</Text>
          <Text style={styles.title}>Product Catalog</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products..."
        />
      </View>

      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null, name: 'All' }, ...activeCategories]}
          keyExtractor={(item) => item.id || 'all'}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === item.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === item.id && styles.categoryChipTextActive,
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.productList}
        renderItem={({ item, index }) => (
          <View style={[styles.gridItem, index % 2 === 0 ? styles.gridItemLeft : styles.gridItemRight]}>
            <ProductCard product={item} onPress={() => openProductModal(item)} variant="grid" />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      <Modal
        visible={selectedProduct !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProductModal}
      >
        {selectedProduct && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Cart</Text>
              <TouchableOpacity onPress={closeProductModal} style={styles.closeButton}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Image
                source={{ uri: selectedProduct.images[0] }}
                style={styles.productImage}
                contentFit="cover"
              />

              <View style={styles.productInfo}>
                <View style={styles.productHeader}>
                  <View style={styles.productTitleRow}>
                    <Text style={styles.productName}>{selectedProduct.name}</Text>
                    {filteredProducts.length > 1 && (
                      <View style={styles.navButtonsRow}>
                        <TouchableOpacity
                          style={[styles.navIconButton, currentProductIndex === 0 && styles.navIconButtonDisabled]}
                          onPress={() => navigateToProduct('prev')}
                          disabled={currentProductIndex === 0}
                        >
                          <ChevronLeft size={20} color={currentProductIndex === 0 ? Colors.light.textTertiary : Colors.light.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.navIconButton, currentProductIndex === filteredProducts.length - 1 && styles.navIconButtonDisabled]}
                          onPress={() => navigateToProduct('next')}
                          disabled={currentProductIndex === filteredProducts.length - 1}
                        >
                          <ChevronRight size={20} color={currentProductIndex === filteredProducts.length - 1 ? Colors.light.textTertiary : Colors.light.text} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {selectedProduct.variations.length > 0 && (
                    <Badge label={`${selectedProduct.variations.length} options`} size="sm" />
                  )}
                  <Text style={styles.productSku}>{selectedProduct.sku}</Text>
                  <Text style={styles.categoryName}>
                    {getCategoryById(selectedProduct.categoryId)?.name || 'Uncategorized'}
                  </Text>
                </View>

                <Text style={styles.productDescription}>{selectedProduct.description}</Text>

                {selectedProduct.variations.map(renderVariationSelector)}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.quantityRow}>
                <Text style={styles.quantityLabel}>Quantity</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => {
                      if (quantity > 1) {
                        setQuantity(q => q - 1);
                        Haptics.selectionAsync();
                      }
                    }}
                  >
                    <Minus size={18} color={quantity > 1 ? Colors.light.text : Colors.light.textTertiary} />
                  </TouchableOpacity>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => {
                      setQuantity(q => q + 1);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Plus size={18} color={Colors.light.text} />
                  </TouchableOpacity>
                </View>
              </View>
              <Button
                title={`Add to Cart • ${(calculatePrice() * quantity).toFixed(2)}`}
                onPress={handleAddToCart}
                icon={<ShoppingCart size={20} color={Colors.light.primaryForeground} />}
                fullWidth
                size="lg"
              />
            </View>


          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: Colors.light.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.light.primaryForeground,
  },
  productList: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  gridItem: {
    flex: 1,
    marginBottom: 12,
  },
  gridItemLeft: {
    marginRight: 6,
  },
  gridItemRight: {
    marginLeft: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textTertiary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
  },
  closeButton: {
    padding: 4,
  },
  productImage: {
    width: '100%',
    height: 300,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  productInfo: {
    padding: 20,
  },
  productHeader: {
    marginBottom: 16,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  navButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconButtonDisabled: {
    opacity: 0.4,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.light.text,
    flex: 1,
  },
  productSku: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  productDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.textSecondary,
    marginBottom: 24,
  },
  variationContainer: {
    marginBottom: 20,
  },
  variationLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.text,
  },
  optionTextSelected: {
    color: Colors.light.primaryForeground,
  },
  optionPrice: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginLeft: 6,
  },
  optionPriceSelected: {
    color: Colors.light.primaryForeground,
    opacity: 0.8,
  },
  checkIcon: {
    marginLeft: 6,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quantityLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    minWidth: 30,
    textAlign: 'center',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },

});
