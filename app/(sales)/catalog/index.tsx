import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowUpDown, Check, Grid, List } from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import Colors from '@/constants/colors';

type SortOption = 'default' | 'price_low' | 'price_high';

export default function SalesCatalog() {
  const router = useRouter();
  const { activeProducts, activeCategories } = useData();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<{ type: 'all' | 'category' | 'ribbon'; id: string | null }>({ type: 'all', id: null });
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Extract unique ribbons/promotion tags from products
  // Combined filter items (All + Ribbons + Categories)
  const filterItems = useMemo(() => {
    const items: { type: 'all' | 'category' | 'ribbon'; id: string | null; label: string }[] = [
      { type: 'all', id: null, label: 'All' }
    ];

    // Add Ribbons
    const ribbons = new Set<string>();
    activeProducts.forEach(product => {
      if (product.ribbon) {
        ribbons.add(product.ribbon);
      }
    });
    Array.from(ribbons).sort().forEach(r => {
      items.push({ type: 'ribbon', id: r, label: r });
    });

    // Add Categories
    activeCategories.forEach(c => {
      items.push({ type: 'category', id: c.id, label: c.name });
    });

    return items;
  }, [activeProducts, activeCategories]);

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: 'default', label: 'Default' },
    { key: 'price_low', label: 'Price: Low to High' },
    { key: 'price_high', label: 'Price: High to Low' },
  ];

  const getSortLabel = (key: SortOption): string => {
    return sortOptions.find(opt => opt.key === key)?.label || 'Default';
  };

  const filteredProducts = useMemo(() => {
    let products = activeProducts.filter(product => {
      // Search filter
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());

      // Category/Ribbon filter
      let matchesFilter = true;
      if (activeFilter.type === 'category' && activeFilter.id) {
        matchesFilter = product.categoryId === activeFilter.id;
      } else if (activeFilter.type === 'ribbon' && activeFilter.id) {
        matchesFilter = product.ribbon === activeFilter.id;
      }

      return matchesSearch && matchesFilter;
    });

    // Apply sorting
    if (sortBy === 'price_low') {
      products = [...products].sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortBy === 'price_high') {
      products = [...products].sort((a, b) => b.basePrice - a.basePrice);
    }

    return products;
  }, [activeProducts, searchQuery, activeFilter, sortBy]);

  const handleProductPress = (productId: string) => {
    router.push(`/(sales)/catalog/${productId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'Sales Rep'}</Text>
          <Text style={styles.title}>Product Catalog</Text>
        </View>
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
          style={{ flex: 1 }}
        />
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortModalVisible(true)}
        >
          <ArrowUpDown size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterItems}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => {
            const isActive = activeFilter.type === item.type && activeFilter.id === item.id;
            const isRibbon = item.type === 'ribbon';

            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isRibbon && styles.filterChipRibbon,
                  isActive && (isRibbon ? styles.filterChipRibbonActive : styles.filterChipActive),
                ]}
                onPress={() => setActiveFilter({ type: item.type, id: item.id })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isRibbon && styles.filterChipRibbonText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort by</Text>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.sortOption}
                onPress={() => {
                  setSortBy(option.key);
                  setSortModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortBy === option.key && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.key && (
                  <Check size={18} color={Colors.light.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        contentContainerStyle={styles.productList}
        columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          viewMode === 'list' ? (
            <View style={styles.listItem}>
              <ProductCard product={item} onPress={() => handleProductPress(item.id)} variant="list" />
            </View>
          ) : (
            <View style={styles.gridItem}>
              <ProductCard product={item} onPress={() => handleProductPress(item.id)} variant="grid" />
            </View>
          )
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
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
    paddingTop: 0,
    paddingBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filtersList: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
    marginRight: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
  },
  filterChipRibbon: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  filterChipRibbonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    includeFontPadding: false, // Fix for Android font padding
    textAlignVertical: 'center',
  },
  filterChipRibbonText: {
    color: '#E65100',
    fontWeight: '600' as const,
  },
  filterChipTextActive: {
    color: Colors.light.primaryForeground,
  },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productList: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 16,
  },
  listItem: {
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  sortOptionText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  sortOptionTextActive: {
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
});
