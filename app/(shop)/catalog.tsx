import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, User } from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import SearchBar from '@/components/SearchBar';
import ShopProductCard from '@/components/ShopProductCard';
import Colors from '@/constants/colors';

export default function ShopCatalogScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { activeProducts, activeCatalogCategories, isSyncing } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const products = useMemo(() => {
    return activeProducts.filter(product => product.isActive);
  }, [activeProducts]);

  const categories = useMemo(() => {
    return activeCatalogCategories;
  }, [activeCatalogCategories]);

  const filterItems = useMemo(() => [{ id: null, name: 'All' }, ...categories], [categories]);

  const filteredProducts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = selectedCategoryId ? product.categoryId === selectedCategoryId : true;
      const matchesSearch = !search ||
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.description.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, selectedCategoryId]);

  const isLoading = isSyncing && products.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>e-order</Text>
          <Text style={styles.title}>Shop products</Text>
        </View>
        <TouchableOpacity
          style={styles.accountButton}
          onPress={() => router.push((isAuthenticated ? '/(shop)/account' : '/(auth)/sign-in') as any)}
        >
          <User size={20} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products or SKU..."
        />
      </View>

      {isAuthenticated && user?.role === 'client' ? (
        <Text style={styles.clientHint}>Signed in as {user.name}</Text>
      ) : null}

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={filterItems}
          keyExtractor={(item) => item.id ?? 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => {
            const active = selectedCategoryId === item.id;
            return (
              <TouchableOpacity
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          key="shop-grid"
          contentContainerStyle={styles.productList}
          columnWrapperStyle={styles.productRow}
          renderItem={({ item }) => (
            <View style={styles.productCell}>
              <ShopProductCard
                product={item}
                onPress={() => router.push(`/(shop)/product/${item.id}` as any)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Search size={48} color={Colors.light.textTertiary} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtitle}>Try another search or category.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  eyebrow: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 2,
  },
  accountButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  clientHint: {
    paddingHorizontal: 20,
    marginBottom: 12,
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  filtersContainer: {
    marginBottom: 14,
  },
  filtersList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  filterTextActive: {
    color: Colors.light.primaryForeground,
  },
  productList: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCell: {
    width: '48%',
    marginBottom: 14,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
});
