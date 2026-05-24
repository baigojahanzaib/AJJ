import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Product, Category, Order, User, Customer, DashboardStats, OrderStatus } from '@/types';
import {
  saveProducts, getCachedProducts,
  saveCategories, getCachedCategories,
  saveCustomers, getCachedCustomers,
  saveOrders, getCachedOrders,
  setLastSyncTimestamp,
  getLastSyncTimestamp,
  getCustomerSyncVersion,
  setCustomerSyncVersion,
} from '@/lib/offline-storage';
import { queueOrder, queueOrderUpdate, updatePendingOrder } from '@/lib/sync-manager';
import { useOffline } from '@/contexts/OfflineContext';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductCsvImportProduct } from '@/lib/product-csv';
import {
  loadImageCacheIndex,
  cacheProductImages,
  resolveCachedImageUri,
  ImageCacheIndex,
} from '@/lib/product-image-cache';
import { getStartingPrice } from '@/lib/product-pricing';
import {
  createCategory as apiCreateCategory,
  createCustomer as apiCreateCustomer,
  createIdempotencyKey,
  createOrder as apiCreateOrder,
  createProduct as apiCreateProduct,
  createUser as apiCreateUser,
  deleteOrder as apiDeleteOrder,
  deleteProduct as apiDeleteProduct,
  deleteUser as apiDeleteUser,
  fetchCategories,
  fetchCustomers,
  fetchOrders,
  fetchProducts,
  fetchUsers,
  updateCategory as apiUpdateCategory,
  updateCustomer as apiUpdateCustomer,
  updateOrder as apiUpdateOrder,
  updateOrderStatus as apiUpdateOrderStatus,
  updateProduct as apiUpdateProduct,
  updateUser as apiUpdateUser,
} from '@/lib/baigo-api';

export type CatalogSortOption = 'default' | 'price_low' | 'price_high';
export type CatalogFilter = { type: 'all' | 'category' | 'ribbon'; id: string | null };
export type SyncProgress = {
  active: boolean;
  label: string;
  completed: number;
  total: number;
  mode: 'full' | 'delta';
};

const CUSTOMER_IMPORT_SYNC_VERSION = 'convex-customers-2026-05-24-v1';

function withoutId<T extends { id?: unknown }>(updates: T): Omit<T, 'id'> {
  const result = { ...updates } as T & { id?: unknown };
  delete result.id;
  return result;
}

function numericApiId(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function compactObject<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map(item => [item.id, item]));
  incoming.forEach(item => byId.set(item.id, item));
  return Array.from(byId.values());
}

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) => (
    (a.company || a.name).localeCompare(b.company || b.name, undefined, { sensitivity: 'base' })
  ));
}

function variantIdForOrderItem(item: Order['items'][number], products: Product[]): number | null {
  const product = products.find(entry => entry.id === item.productId);
  const matchingCombination = product?.combinations?.find(combination => {
    if (combination.sku && combination.sku === item.productSku) return true;
    if (item.selectedVariations.length === 0 && combination.options.length === 0) return true;
    return combination.options.every(option =>
      item.selectedVariations.some(selection =>
        selection.variationName.toLowerCase() === option.name.toLowerCase() &&
        selection.optionName.toLowerCase() === option.value.toLowerCase()
      )
    );
  }) ?? product?.combinations?.[0];

  const id = Number(matchingCombination?.id ?? item.productId);
  return Number.isFinite(id) ? id : null;
}

function orderToApiPayload(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>, products: Product[]) {
  const apiItems = orderData.items
    .map(item => ({
      variant_id: variantIdForOrderItem(item, products),
      quantity: item.quantity,
      unit_price: item.unitPrice,
    }))
    .filter(item => item.variant_id !== null && item.quantity > 0);

  return compactObject({
    customer_id: numericApiId(orderData.customerId),
    customer_name: orderData.customerName,
    customer_email: orderData.customerEmail,
    customer_phone: orderData.customerPhone,
    delivery_method: 'delivery',
    ship_line1: orderData.customerAddress,
    ship_gps_lat: orderData.latitude,
    ship_gps_lng: orderData.longitude,
    payment_method: orderData.orderSource === 'client_shop' ? 'cod' : 'on_account',
    notes_customer: orderData.notes,
    items: apiItems,
  });
}

export const [DataProvider, useData] = createContextHook(() => {
  const { isOfflineMode, refreshPendingCount } = useOffline();
  const { showToast } = useNotification();
  const { user, isAuthenticated } = useAuth();

  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([]);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
  const [cachedUsers, setCachedUsers] = useState<User[]>([]);
  const [imageCacheIndex, setImageCacheIndex] = useState<ImageCacheIndex>({});
  const imageCacheIndexRef = useRef<ImageCacheIndex>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CatalogFilter>({ type: 'all', id: null });
  const [sortBy, setSortBy] = useState<CatalogSortOption>('default');
  const [hasHydratedCache, setHasHydratedCache] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    active: false,
    label: '',
    completed: 0,
    total: 0,
    mode: 'full',
  });
  const autoSyncKeyRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);

  const loadCachedData = useCallback(async () => {
    const [productsCache, categoriesCache, customersCache, ordersCache, imageIndex] = await Promise.all([
      getCachedProducts(),
      getCachedCategories(),
      getCachedCustomers(),
      getCachedOrders(),
      loadImageCacheIndex(),
    ]);
    setCachedProducts(productsCache);
    setCachedCategories(categoriesCache);
    setCachedCustomers(customersCache);
    setCachedOrders(ordersCache);
    setImageCacheIndex(imageIndex);
    imageCacheIndexRef.current = imageIndex;
    setHasHydratedCache(true);
    return { productsCache, categoriesCache, customersCache, ordersCache };
  }, []);

  const syncData = useCallback(async (
    _seed?: {
      productsCache: Product[];
      categoriesCache: Category[];
      customersCache: Customer[];
      ordersCache: Order[];
    },
    options?: { silent?: boolean }
  ) => {
    if (syncInFlightRef.current || isOfflineMode) return;

    syncInFlightRef.current = true;
    setIsSyncing(true);
    const syncStartedAt = new Date().toISOString();
    const baselineProducts = _seed?.productsCache ?? cachedProducts;
    const baselineCategories = _seed?.categoriesCache ?? cachedCategories;
    const baselineCustomers = _seed?.customersCache ?? cachedCustomers;
    const baselineOrders = _seed?.ordersCache ?? cachedOrders;
    let lastSync: string | null = null;
    let customerSyncVersion: string | null = null;
    try {
      [lastSync, customerSyncVersion] = await Promise.all([
        getLastSyncTimestamp(),
        getCustomerSyncVersion(),
      ]);
    } catch (error) {
      console.warn('[Data] Could not read sync metadata:', error);
    }
    const canSyncCustomers = isAuthenticated && (user?.role === 'admin' || user?.role === 'sales_rep');
    const canSyncOrders = isAuthenticated;
    const canSyncUsers = isAuthenticated && user?.role === 'admin';
    const needsCustomerImportRefresh = canSyncCustomers && customerSyncVersion !== CUSTOMER_IMPORT_SYNC_VERSION;
    const productDeltaAfter = lastSync && baselineProducts.length > 0 ? lastSync : null;
    const categoryDeltaAfter = lastSync && baselineCategories.length > 0 ? lastSync : null;
    const customerDeltaAfter = !needsCustomerImportRefresh && lastSync && baselineCustomers.length > 0 ? lastSync : null;
    const orderDeltaAfter = lastSync && baselineOrders.length > 0 ? lastSync : null;
    const syncMode: SyncProgress['mode'] = productDeltaAfter || categoryDeltaAfter || customerDeltaAfter || orderDeltaAfter
      ? 'delta'
      : 'full';
    const totalSteps = 2 + (canSyncCustomers ? 1 : 0) + (canSyncOrders ? 1 : 0) + (canSyncUsers ? 1 : 0);
    let completed = 0;

    const runStep = async <T,>(label: string, task: () => Promise<T>) => {
      setSyncProgress({ active: true, label, completed, total: totalSteps, mode: syncMode });
      const result = await task();
      completed += 1;
      setSyncProgress({ active: true, label, completed, total: totalSteps, mode: syncMode });
      return result;
    };

    try {
      const products = await runStep(
        productDeltaAfter ? 'Syncing changed products' : 'Syncing products',
        () => fetchProducts({ updatedAfter: productDeltaAfter })
      );
      const nextProducts = productDeltaAfter ? mergeById(baselineProducts, products) : products;
      setCachedProducts(nextProducts);
      await saveProducts(nextProducts);

      const categories = await runStep(
        categoryDeltaAfter ? 'Syncing changed categories' : 'Syncing categories',
        () => fetchCategories({ updatedAfter: categoryDeltaAfter })
      );
      const nextCategories = categoryDeltaAfter ? mergeById(baselineCategories, categories) : categories;
      setCachedCategories(nextCategories);
      await saveCategories(nextCategories);

      void cacheProductImages(
        nextProducts,
        imageCacheIndexRef.current,
        { cacheMode: 'primary', concurrency: 3, maxImages: 250 }
      ).then((imageCacheResult) => {
        if (imageCacheResult.updated) {
          imageCacheIndexRef.current = imageCacheResult.index;
          setImageCacheIndex(imageCacheResult.index);
        }
      }).catch((error) => {
        console.warn('[Data] Product image cache refresh failed:', error);
      });

      if (canSyncCustomers) {
        const customers = await runStep(
          customerDeltaAfter ? 'Syncing changed customers' : 'Syncing all customers',
          () => fetchCustomers({ updatedAfter: customerDeltaAfter })
        );
        const nextCustomers = sortCustomers(customerDeltaAfter ? mergeById(baselineCustomers, customers) : customers);
        setCachedCustomers(nextCustomers);
        await saveCustomers(nextCustomers);
        await setCustomerSyncVersion(CUSTOMER_IMPORT_SYNC_VERSION);
      }

      if (canSyncOrders) {
        const orders = await runStep(
          orderDeltaAfter ? 'Syncing changed orders' : 'Syncing orders',
          () => fetchOrders({ updatedAfter: orderDeltaAfter })
        );
        const nextOrders = (orderDeltaAfter ? mergeById(baselineOrders, orders) : orders)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCachedOrders(nextOrders);
        await saveOrders(nextOrders);
      }

      if (canSyncUsers) {
        const users = await runStep('Syncing users', () => fetchUsers());
        setCachedUsers(users);
      }

      await setLastSyncTimestamp(syncStartedAt);
      if (!options?.silent) {
        showToast('Website data synced', 'success');
      }
    } catch (error) {
      console.error('[Data] Website API sync failed:', error);
      if (!options?.silent) showToast('Sync failed. Some data may be outdated.', 'error');
      throw error;
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
      setSyncProgress(current => ({ ...current, active: false, label: '', completed: 0, total: 0 }));
    }
  }, [
    cachedCategories,
    cachedCustomers,
    cachedOrders,
    cachedProducts,
    isAuthenticated,
    isOfflineMode,
    showToast,
    user?.role,
  ]);

  const loadCachedDataAndSync = useCallback(async () => {
    const seed = await loadCachedData();
    if (!isOfflineMode) await syncData(seed);
  }, [isOfflineMode, loadCachedData, syncData]);

  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);

  useEffect(() => {
    if (!hasHydratedCache || isOfflineMode) return;
    const key = `${user?.id ?? 'guest'}:website-api`;
    if (autoSyncKeyRef.current === key) return;
    autoSyncKeyRef.current = key;
    syncData(undefined, { silent: true }).catch(() => {
      // Keep this key marked as attempted so an auth/network failure does not
      // restart the same auto-sync loop on every cache state change.
    });
  }, [hasHydratedCache, isOfflineMode, syncData, user?.id]);

  const products = cachedProducts;
  const categories = cachedCategories;
  const customers = cachedCustomers;
  const orders = cachedOrders;
  const users = cachedUsers;

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  const activeCategories = useMemo(() => categories.filter(c => c.isActive), [categories]);
  const activeCustomers = useMemo(() => customers.filter(c => c.isActive), [customers]);

  const filteredSortedProducts = useMemo(() => {
    let prods = activeProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      let matchesFilter = true;
      if (activeFilter.type === 'category' && activeFilter.id) {
        matchesFilter = product.categoryId === activeFilter.id;
      } else if (activeFilter.type === 'ribbon' && activeFilter.id) {
        matchesFilter = product.ribbon === activeFilter.id;
      }
      return matchesSearch && matchesFilter;
    });
    if (sortBy === 'price_low') {
      prods = [...prods].sort((a, b) => getStartingPrice(a) - getStartingPrice(b));
    } else if (sortBy === 'price_high') {
      prods = [...prods].sort((a, b) => getStartingPrice(b) - getStartingPrice(a));
    }
    return prods;
  }, [activeFilter, activeProducts, searchQuery, sortBy]);

  const getProductById = useCallback((id: string) => products.find(p => p.id === id), [products]);
  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);
  const getOrderById = useCallback((id: string) => orders.find(o => o.id === id || o.orderNumber === id), [orders]);
  const getUserById = useCallback((id: string) => users.find(u => u.id === id), [users]);
  const getCustomerById = useCallback((id: string) => customers.find(c => c.id === id), [customers]);
  const getOrdersBySalesRep = useCallback((salesRepId: string) => orders.filter(o => o.salesRepId === salesRepId), [orders]);
  const getProductsByCategory = useCallback((categoryId: string) => products.filter(p => p.categoryId === categoryId && p.isActive), [products]);
  const searchProducts = useCallback((query: string) => {
    const lowercaseQuery = query.toLowerCase();
    return activeProducts.filter(p =>
      p.name.toLowerCase().includes(lowercaseQuery) ||
      p.description.toLowerCase().includes(lowercaseQuery) ||
      p.sku.toLowerCase().includes(lowercaseQuery)
    );
  }, [activeProducts]);

  const resolveImageUri = useCallback((uri?: string) => (
    uri ? resolveCachedImageUri(uri, imageCacheIndex) || uri : undefined
  ), [imageCacheIndex]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'createdAt'>) => {
    const created = await apiCreateProduct(product);
    setCachedProducts(prev => {
      const next = [created, ...prev.filter(item => item.id !== created.id)];
      saveProducts(next);
      return next;
    });
    return created;
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const updated = await apiUpdateProduct(id, withoutId(updates));
    setCachedProducts(prev => {
      const next = prev.map(product => product.id === id ? updated : product);
      saveProducts(next);
      return next;
    });
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await apiDeleteProduct(id);
    setCachedProducts(prev => {
      const next = prev.map(product => product.id === id ? { ...product, isActive: false } : product);
      saveProducts(next);
      return next;
    });
  }, []);

  const importProducts = useCallback(async (importedProducts: ProductCsvImportProduct[]) => {
    let created = 0;
    let updated = 0;
    const failures: { sku: string; message: string }[] = [];
    const importedDocs: Product[] = [];
    for (const importedProduct of importedProducts) {
      try {
        const existing = importedProduct.id ? products.find(item => item.id === importedProduct.id) : undefined;
        const saved = existing
          ? await apiUpdateProduct(existing.id, importedProduct)
          : await apiCreateProduct({
            ...importedProduct,
            categoryId: importedProduct.categoryId ?? '',
          });
        importedDocs.push(saved);
        existing ? updated++ : created++;
      } catch (error) {
        failures.push({ sku: importedProduct.sku, message: error instanceof Error ? error.message : String(error) });
      }
    }
    if (importedDocs.length > 0) {
      const map = new Map(products.map(product => [product.id, product]));
      importedDocs.forEach(product => map.set(product.id, product));
      const next = Array.from(map.values());
      setCachedProducts(next);
      await saveProducts(next);
    }
    return { created, updated, failed: failures.length, failures };
  }, [products]);

  const addCategory = useCallback(async (category: Omit<Category, 'id' | 'createdAt'>) => {
    const created = await apiCreateCategory(category);
    setCachedCategories(prev => {
      const next = [created, ...prev];
      saveCategories(next);
      return next;
    });
    return created;
  }, []);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    const updated = await apiUpdateCategory(id, withoutId(updates));
    setCachedCategories(prev => {
      const next = prev.map(category => category.id === id ? updated : category);
      saveCategories(next);
      return next;
    });
  }, []);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    if (isOfflineMode) throw new Error('Cannot create customers while offline.');
    const created = await apiCreateCustomer(customer);
    setCachedCustomers(prev => {
      const next = sortCustomers([created, ...prev.filter(item => item.id !== created.id)]);
      saveCustomers(next);
      return next;
    });
    return created;
  }, [isOfflineMode]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    if (isOfflineMode) return;
    const updated = await apiUpdateCustomer(id, withoutId(updates));
    setCachedCustomers(prev => {
      const next = prev.map(customer => customer.id === id ? updated : customer);
      saveCustomers(next);
      return next;
    });
  }, [isOfflineMode]);

  const addOrder = useCallback(async (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => {
    if (isOfflineMode) {
      const queuedOrder = await queueOrder(orderData);
      await refreshPendingCount();
      return {
        ...queuedOrder,
        id: queuedOrder.tempId,
        orderNumber: 'PENDING-SYNC',
        updatedAt: queuedOrder.createdAt,
      } as Order;
    }

    const payload = orderToApiPayload(orderData, products);
    const created = await apiCreateOrder(payload, createIdempotencyKey());
    setCachedOrders(prev => {
      const next = [created, ...prev.filter(order => order.id !== created.id)];
      saveOrders(next);
      return next;
    });
    if (created.customerId && orderData.customerName.trim()) {
      setCachedCustomers(prev => {
        const existing = prev.find(customer => customer.id === created.customerId);
        const nextCustomer: Customer = {
          id: created.customerId!,
          name: orderData.customerName,
          phone: orderData.customerPhone,
          email: orderData.customerEmail,
          address: orderData.customerAddress,
          latitude: orderData.latitude,
          longitude: orderData.longitude,
          company: existing?.company,
          isActive: true,
          createdAt: existing?.createdAt ?? created.createdAt,
          ecwidId: existing?.ecwidId,
        };
        const next = sortCustomers([nextCustomer, ...prev.filter(customer => customer.id !== created.customerId)]);
        saveCustomers(next);
        return next;
      });
    }
    showToast('Order placed successfully!', 'success');
    return created;
  }, [isOfflineMode, products, refreshPendingCount, showToast]);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    const existing = getOrderById(id);
    if (!existing) return;
    if (isOfflineMode) {
      const now = new Date().toISOString();
      const nextOrders = orders.map(order => order.id === id ? { ...order, status, updatedAt: now } : order);
      setCachedOrders(nextOrders);
      await saveOrders(nextOrders);
      if (id.startsWith('TEMP-')) {
        await updatePendingOrder(id, { status });
      } else {
        await queueOrderUpdate({
          orderId: id,
          updates: { status },
          editedBy: user?.id || 'offline-user',
          editedByName: user?.name || 'Offline User',
          changeDescription: 'Updated: status',
        });
      }
      await refreshPendingCount();
      showToast('Order status saved offline. It will sync when online.', 'info');
      return;
    }
    const updated = await apiUpdateOrderStatus(existing.orderNumber, status);
    setCachedOrders(prev => {
      const next = prev.map(order => order.id === existing.id ? updated : order);
      saveOrders(next);
      return next;
    });
  }, [getOrderById, isOfflineMode, orders, refreshPendingCount, showToast, user?.id, user?.name]);

  const updateOrder = useCallback(async (
    id: string,
    updates: Partial<Order>,
    editedBy: string,
    editedByName: string,
    changeDescription: string
  ) => {
    const existing = getOrderById(id);
    const safeUpdates = compactObject(withoutId(updates));
    if (!existing) return;
    if (isOfflineMode) {
      const now = new Date().toISOString();
      const nextOrders = orders.map(order => order.id === id ? {
        ...order,
        ...safeUpdates,
        updatedAt: now,
        editLog: [...(order.editLog || []), { editedAt: now, editedBy, editedByName, changes: changeDescription }],
      } : order);
      setCachedOrders(nextOrders);
      await saveOrders(nextOrders);
      await queueOrderUpdate({ orderId: id, updates: safeUpdates, editedBy, editedByName, changeDescription });
      await refreshPendingCount();
      showToast('Order changes saved offline. They will sync when online.', 'info');
      return;
    }
    const updated = await apiUpdateOrder(existing.orderNumber, safeUpdates, changeDescription);
    setCachedOrders(prev => {
      const next = prev.map(order => order.id === existing.id ? updated : order);
      saveOrders(next);
      return next;
    });
  }, [getOrderById, isOfflineMode, orders, refreshPendingCount, showToast]);

  const undoOrderEdit = useCallback(async (_id: string) => {
    showToast('Undo is not available after migrating to the website order API.', 'info');
  }, [showToast]);

  const deleteOrder = useCallback(async (id: string) => {
    const existing = getOrderById(id);
    if (!existing || isOfflineMode) return;
    await apiDeleteOrder(existing.orderNumber);
    setCachedOrders(prev => {
      const next = prev.filter(order => order.id !== existing.id);
      saveOrders(next);
      return next;
    });
  }, [getOrderById, isOfflineMode]);

  const syncOrderToWebsiteAdmin = useCallback(async (_id: string) => {
    showToast('Orders now sync automatically through the website admin API.', 'info');
  }, [showToast]);

  const syncOrderStatusToWebsiteAdmin = useCallback(async (_id: string, _status: string) => {
    return;
  }, []);

  const addUser = useCallback(async (newUser: Omit<User, 'id' | 'createdAt'>) => {
    const created = await apiCreateUser(newUser);
    setCachedUsers(prev => [created, ...prev]);
    return created;
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    const updated = await apiUpdateUser(id, withoutId(updates));
    setCachedUsers(prev => prev.map(entry => entry.id === id ? updated : entry));
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    await apiDeleteUser(id);
    setCachedUsers(prev => prev.map(entry => entry.id === id ? { ...entry, isActive: false } : entry));
  }, []);

  const dashboardStats: DashboardStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const ordersThisMonth = orders.filter(o => new Date(o.createdAt) >= startOfMonth);
    return {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
      totalProducts: products.length,
      totalUsers: users.filter(entry => entry.role === 'sales_rep').length,
      pendingOrders: orders.filter(order => order.status === 'pending').length,
      ordersThisMonth: ordersThisMonth.length,
      revenueThisMonth: ordersThisMonth.reduce((sum, order) => sum + order.total, 0),
    };
  }, [orders, products.length, users]);

  return {
    products,
    categories,
    orders,
    users,
    activeProducts,
    activeCategories,
    activeCustomers,
    filteredSortedProducts,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    dashboardStats,
    getProductById,
    getCategoryById,
    getOrderById,
    getUserById,
    getCustomerById,
    getOrdersBySalesRep,
    getProductsByCategory,
    searchProducts,
    resolveImageUri,
    addProduct,
    updateProduct,
    deleteProduct,
    importProducts,
    addCustomer,
    updateCustomer,
    addCategory,
    updateCategory,
    addOrder,
    updateOrderStatus,
    updateOrder,
    undoOrderEdit,
    deleteOrder,
    syncOrderToWebsiteAdmin,
    syncOrderStatusToWebsiteAdmin,
    loadCachedDataAndSync,
    isSyncing,
    syncProgress,
    addUser,
    updateUser,
    deleteUser,
  };
});
