import { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Grid, List, FileUp, Package } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useData } from '@/contexts/DataContext';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import Button from '@/components/Button';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

export default function AdminProducts() {
  const router = useRouter();
  const { products, categories } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });
  const [showAddOptions, setShowAddOptions] = useState(false);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductPress = (productId: string) => {
    router.push(`/(admin)/product/${productId}`);
  };

  const handleAddProduct = () => {
    setShowAddOptions(true);
  };

  const handleAddIndividualProduct = () => {
    setShowAddOptions(false);
    router.push('/(admin)/add-product');
  };

  const handleImportCSV = async () => {
    setShowAddOptions(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log('CSV file selected:', file.name);
        setAlertConfig({
          visible: true,
          title: 'CSV Import',
          message: `File "${file.name}" selected. CSV import functionality will process your products in batch.`,
          type: 'info',
          buttons: [
            { text: 'OK', onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
          ],
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to open file picker. Please try again.',
        type: 'error',
        buttons: [
          { text: 'OK', onPress: () => setAlertConfig(prev => ({ ...prev, visible: false })) },
        ],
      });
    }
  };

  const renderProduct = ({ item, index }: { item: typeof products[0]; index: number }) => {
    if (viewMode === 'list') {
      return (
        <View style={styles.listItem}>
          <ProductCard product={item} onPress={() => handleProductPress(item.id)} variant="list" />
        </View>
      );
    }

    return (
      <View style={[styles.gridItem, index % 2 === 0 ? styles.gridItemLeft : styles.gridItemRight]}>
        <ProductCard product={item} onPress={() => handleProductPress(item.id)} variant="grid" />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewToggle, viewMode === 'grid' && styles.viewToggleActive]}
            onPress={() => setViewMode('grid')}
          >
            <Grid size={18} color={viewMode === 'grid' ? Colors.light.primary : Colors.light.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleActive]}
            onPress={() => setViewMode('list')}
          >
            <List size={18} color={viewMode === 'list' ? Colors.light.primary : Colors.light.textTertiary} />
          </TouchableOpacity>
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
          data={[{ id: null, name: 'All' }, ...categories]}
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
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        contentContainerStyle={styles.productList}
        renderItem={renderProduct}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      <View style={styles.fab}>
        {showAddOptions && (
          <View style={styles.addOptionsDropdown}>
            <TouchableOpacity
              style={styles.addOption}
              onPress={handleAddIndividualProduct}
            >
              <View style={styles.addOptionIcon}>
                <Package size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.addOptionContent}>
                <Text style={styles.addOptionTitle}>Add Individual Product</Text>
                <Text style={styles.addOptionSubtitle}>Create a single product manually</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.addOptionDivider} />
            <TouchableOpacity
              style={styles.addOption}
              onPress={handleImportCSV}
            >
              <View style={styles.addOptionIcon}>
                <FileUp size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.addOptionContent}>
                <Text style={styles.addOptionTitle}>Import from CSV</Text>
                <Text style={styles.addOptionSubtitle}>Bulk import products from file</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        <Button
          title="Add Product"
          onPress={handleAddProduct}
          icon={<Plus size={20} color={Colors.light.primaryForeground} />}
        />
      </View>

      {showAddOptions && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowAddOptions(false)}
        />
      )}

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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewToggle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleActive: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.primary,
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
    gap: 8,
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
    paddingBottom: 100,
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
  listItem: {
    marginBottom: 12,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    left: 20,
    zIndex: 10,
  },
  addOptionsDropdown: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  addOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  addOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  addOptionContent: {
    flex: 1,
  },
  addOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  addOptionSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  addOptionDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 5,
  },
});
