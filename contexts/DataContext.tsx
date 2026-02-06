import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useAction, useConvex } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Product, Category, Order, User, Customer, DashboardStats, OrderStatus } from '@/types';
import { Id } from '../convex/_generated/dataModel';
import {
  saveProducts, getCachedProducts,
  saveCategories, getCachedCategories,
  saveCustomers, getCachedCustomers,
  saveOrders, getCachedOrders,
  setLastSyncTimestamp
} from '../lib/offline-storage';
import { queueOrder, queueOrderUpdate, updatePendingOrder } from '../lib/sync-manager';
import { useOffline } from './OfflineContext';
import * as Haptics from 'expo-haptics';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';
import {
  loadImageCacheIndex,
  cacheProductImages,
  resolveCachedImageUri,
  ImageCacheIndex
} from '../lib/product-image-cache';

// Helper to map Convex document to our types
function mapProduct(doc: any): Product {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    sku: doc.sku,
    basePrice: doc.basePrice,
    compareAtPrice: doc.compareAtPrice,
    images: doc.images,
    categoryId: doc.categoryId,
    isActive: doc.isActive,
    variations: doc.variations,
    stock: doc.stock,
    createdAt: doc.createdAt,
    moq: doc.moq,
    ribbon: doc.ribbon,
    ribbonColor: doc.ribbonColor,
    combinations: doc.combinations,
    ecwidId: doc.ecwidId,
  };
}

function mapCategory(doc: any): Category {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    image: doc.image,
    parentId: doc.parentId,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    ecwidId: doc.ecwidId,
  };
}

function mapOrder(doc: any): Order {
  return {
    id: doc._id,
    orderNumber: doc.orderNumber,
    salesRepId: doc.salesRepId,
    salesRepName: doc.salesRepName,
    customerName: doc.customerName,
    customerPhone: doc.customerPhone,
    customerEmail: doc.customerEmail,
    customerAddress: doc.customerAddress,
    latitude: doc.latitude,
    longitude: doc.longitude,
    items: doc.items,
    subtotal: doc.subtotal,
    tax: doc.tax,
    discount: doc.discount,
    total: doc.total,
    status: doc.status,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    previousVersion: doc.previousVersion,
    editLog: doc.editLog,
    ecwidOrderId: doc.ecwidOrderId,
  };
}

function mapUser(doc: any): User {
  return {
    id: doc._id,
    email: doc.email,
    password: '',
    name: doc.name,
    role: doc.role,
    phone: doc.phone,
    avatar: doc.avatar,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

function mapCustomer(doc: any): Customer {
  return {
    id: doc._id,
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    latitude: doc.latitude,
    longitude: doc.longitude,
    company: doc.company,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    ecwidId: doc.ecwidId,
  };
}

function withoutId<T extends { id?: unknown }>(updates: T): Omit<T, 'id'> {
  const result = { ...updates } as T & { id?: unknown };
  delete result.id;
  return result;
}

function compactObject<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>;
}

export type CatalogSortOption = 'default' | 'price_low' | 'price_high';
export type CatalogFilter = { type: 'all' | 'category' | 'ribbon'; id: string | null };

export const [DataProvider, useData] = createContextHook(() => {
  const { isOfflineMode, refreshPendingCount } = useOffline();
  const { showToast } = useNotification();
  const { user, isAuthenticated } = useAuth();

  // Local state for offline data
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([]);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
  const [imageCacheIndex, setImageCacheIndex] = useState<ImageCacheIndex>({});
  const imageCacheIndexRef = useRef<ImageCacheIndex>({});

  // Catalog Shared State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CatalogFilter>({ type: 'all', id: null });
  const [sortBy, setSortBy] = useState<CatalogSortOption>('default');

  // Track previous orders for notifications
  const prevOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const [hasHydratedCache, setHasHydratedCache] = useState(false);
  const autoSyncKeyRef = useRef<string | null>(null);
  const emptyCacheWarningShownRef = useRef(false);

  // Manual sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Convex queries (Skip standard 'list' to avoid huge payload)
  // We use direct client.query() for sync instead.
  // const convexProducts = useQuery(api.products.list); // DISABLED

  // Keep other queries that are small enough or needed live
  const convexCategories = useQuery(api.categories.list, isAuthenticated ? {} : "skip");
  const convexOrders = useQuery(api.orders.list, isAuthenticated ? {} : "skip");
  const convexUsersQuery = useQuery(api.users.list, isAuthenticated ? {} : "skip");
  const convexUsers = useMemo(() => convexUsersQuery ?? [], [convexUsersQuery]);
  const convexDashboardStats = useQuery(api.orders.getDashboardStats, isAuthenticated ? {} : "skip");

  // Convex mutations
  const createProductMutation = useMutation(api.products.create);
  const updateProductMutation = useMutation(api.products.update);
  const removeProductMutation = useMutation(api.products.remove);
  const createCategoryMutation = useMutation(api.categories.create);
  const updateCategoryMutation = useMutation(api.categories.update);
  const updateOrderMutation = useMutation(api.orders.update);
  const createOrderMutation = useMutation(api.orders.create);
  const updateOrderStatusMutation = useMutation(api.orders.updateStatus);
  const undoOrderEditMutation = useMutation(api.orders.undoEdit);
  const removeOrderMutation = useMutation(api.orders.remove);
  const createUserMutation = useMutation(api.users.create);
  const updateUserMutation = useMutation(api.users.update);
  const removeUserMutation = useMutation(api.users.remove);
  const createCustomerMutation = useMutation(api.customers.create);
  const updateCustomerMutation = useMutation(api.customers.update);

  const pushOrderAction = useAction(api.ecwid.syncOrderToEcwid);
  const pushOrderStatusAction = useAction(api.ecwid.syncOrderStatusToEcwid);

  // Use the Convex client directly for manual fetches
  const convex = useConvex();

  const loadCachedData = useCallback(async () => {
    try {
      console.log('[Data] Loading cached data...');
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

      console.log(
        `[Data] Cached loaded: ${productsCache.length} prods, ${categoriesCache.length} cats, ${customersCache.length} custs, ${ordersCache.length} orders, ${Object.keys(imageIndex).length} cached images`
      );

      return {
        productsCache,
        categoriesCache,
        customersCache,
        ordersCache,
      };
    } catch (error) {
      console.error('[Data] Error loading cache:', error);
      setHasHydratedCache(true);
      return {
        productsCache: [] as Product[],
        categoriesCache: [] as Category[],
        customersCache: [] as Customer[],
        ordersCache: [] as Order[],
      };
    }
  }, []);

  const syncData = useCallback(async (
    seed?: {
      productsCache: Product[];
      categoriesCache: Category[];
      customersCache: Customer[];
      ordersCache: Order[];
    },
    options?: { silent?: boolean }
  ) => {
    if (isSyncing || isOfflineMode || !isAuthenticated) return;

    setIsSyncing(true);
    console.log('[Data] Starting synchronization...');

    const currentProdCache = seed?.productsCache ?? cachedProducts;
    const currentCatCache = seed?.categoriesCache ?? cachedCategories;
    const currentCustCache = seed?.customersCache ?? cachedCustomers;
    const currentOrderCache = seed?.ordersCache ?? cachedOrders;
    let imageSyncSummary: { ready: number; total: number } | null = null;

    try {
      // Fetch all active products with pagination.
      const productMap = new Map(currentProdCache.map((item) => [item.id, item]));
      let productCursor: string | null = null;
      let productDone = false;
      let productPages = 0;

      while (!productDone && productPages < 100) {
        const result: any = await convex.query(api.products.list, {
          cursor: productCursor ?? undefined,
          limit: 200,
        });

        if (!result || !result.page) break;
        result.page.map(mapProduct).forEach((item: Product) => productMap.set(item.id, item));
        productCursor = result.continueCursor;
        productDone = result.isDone;
        productPages++;
      }

      const mergedProducts = Array.from(productMap.values());
      setCachedProducts(mergedProducts);
      await saveProducts(mergedProducts);
      console.log(`[Data] Product sync complete: ${mergedProducts.length}`);

      const imageCacheResult = await cacheProductImages(
        mergedProducts,
        imageCacheIndexRef.current,
        { cacheMode: 'all', concurrency: 6 }
      );
      if (imageCacheResult.updated) {
        imageCacheIndexRef.current = imageCacheResult.index;
        setImageCacheIndex(imageCacheResult.index);
      }
      console.log(
        `[Data] Product image cache: total=${imageCacheResult.total}, downloaded=${imageCacheResult.downloaded}, reused=${imageCacheResult.reused}, failed=${imageCacheResult.failed}`
      );
      imageSyncSummary = {
        ready: imageCacheResult.downloaded + imageCacheResult.reused,
        total: imageCacheResult.total,
      };

      // Fetch all active customers with pagination.
      const customerMap = new Map(currentCustCache.map((item) => [item.id, item]));
      let customerCursor: string | null = null;
      let customerDone = false;
      let customerPages = 0;

      while (!customerDone && customerPages < 100) {
        const result: any = await convex.query(api.customers.list, {
          cursor: customerCursor ?? undefined,
          limit: 200,
        });

        if (!result || !result.page) break;
        result.page.map(mapCustomer).forEach((item: Customer) => customerMap.set(item.id, item));
        customerCursor = result.continueCursor;
        customerDone = result.isDone;
        customerPages++;
      }

      const mergedCustomers = Array.from(customerMap.values());
      setCachedCustomers(mergedCustomers);
      await saveCustomers(mergedCustomers);
      console.log(`[Data] Customer sync complete: ${mergedCustomers.length}`);

      // Categories are small enough to fetch in one request.
      const categoriesRaw = await convex.query(api.categories.list, {});
      if (categoriesRaw) {
        const categoryMap = new Map(currentCatCache.map((item) => [item.id, item]));
        categoriesRaw.map(mapCategory).forEach((item: Category) => categoryMap.set(item.id, item));
        const mergedCategories = Array.from(categoryMap.values());
        setCachedCategories(mergedCategories);
        await saveCategories(mergedCategories);
        console.log(`[Data] Category sync complete: ${mergedCategories.length}`);
      }

      // Orders endpoint is currently take(limit), so fetch a large window.
      const ordersRaw = await convex.query(api.orders.list, { limit: 5000 });
      if (ordersRaw) {
        const orderMap = new Map(currentOrderCache.map((item) => [item.id, item]));
        ordersRaw.map(mapOrder).forEach((item: Order) => orderMap.set(item.id, item));
        const mergedOrders = Array.from(orderMap.values());
        setCachedOrders(mergedOrders);
        await saveOrders(mergedOrders);
        console.log(`[Data] Order sync complete: ${mergedOrders.length}`);
      }

      await setLastSyncTimestamp(new Date().toISOString());
      if (!options?.silent) {
        if (imageSyncSummary && imageSyncSummary.total > 0) {
          showToast(
            `Offline sync complete. ${imageSyncSummary.ready}/${imageSyncSummary.total} product images ready.`,
            'success'
          );
        } else {
          showToast('Offline database fully synced', 'success');
        }
      }
    } catch (err) {
      console.error('[Data] Sync failed:', err);
      showToast('Sync failed partially. Some data may be outdated.', 'error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [
    cachedCategories,
    cachedCustomers,
    cachedOrders,
    cachedProducts,
    convex,
    isAuthenticated,
    isOfflineMode,
    isSyncing,
    showToast,
  ]);

  const loadCachedDataAndSync = useCallback(async () => {
    const seed = await loadCachedData();

    if (!isOfflineMode && isAuthenticated) {
      await syncData(seed);
    }
  }, [isAuthenticated, isOfflineMode, loadCachedData, syncData]);

  // Initial cache hydration.
  useEffect(() => {
    loadCachedData();
  }, [loadCachedData]);

  // Auto sync once per online session per user.
  useEffect(() => {
    if (isOfflineMode || !isAuthenticated || !user?.id) {
      autoSyncKeyRef.current = null;
    }
  }, [isAuthenticated, isOfflineMode, user?.id]);

  useEffect(() => {
    if (!hasHydratedCache || isOfflineMode || !isAuthenticated || !user?.id) return;

    const key = `${user.id}:online`;
    if (autoSyncKeyRef.current === key) return;
    autoSyncKeyRef.current = key;

    syncData(undefined, { silent: true }).catch(() => {
      autoSyncKeyRef.current = null;
    });
  }, [hasHydratedCache, isAuthenticated, isOfflineMode, syncData, user?.id]);

  useEffect(() => {
    if (!hasHydratedCache) return;
    if (!isOfflineMode) {
      emptyCacheWarningShownRef.current = false;
      return;
    }

    const hasOfflineSnapshot =
      cachedProducts.length > 0 ||
      cachedCategories.length > 0 ||
      cachedCustomers.length > 0 ||
      cachedOrders.length > 0;

    if (!hasOfflineSnapshot && !emptyCacheWarningShownRef.current) {
      emptyCacheWarningShownRef.current = true;
      showToast('No offline snapshot yet. Connect once to sync data.', 'error');
    }
  }, [
    cachedCategories.length,
    cachedCustomers.length,
    cachedOrders.length,
    cachedProducts.length,
    hasHydratedCache,
    isOfflineMode,
    showToast,
  ]);

  // Reactive Caching Listeners
  // If we are online and using the app, getting live updates via `useQuery` (Convex)
  // we want to immediately save those to disk so if we go offline 1s later, we have it.

  // Note: We disabled `useQuery(api.products.list)` in original code to save bandwidth/performance.
  // So we rely on `syncData` (manual fetch) for products.

  // For Categories:
  useEffect(() => {
    if (convexCategories && !isOfflineMode && isAuthenticated) {
      const mapped = convexCategories.map(mapCategory);
      setCachedCategories(mapped);
      saveCategories(mapped);
    }
  }, [convexCategories, isAuthenticated, isOfflineMode]);

  // For Orders: (Only syncs the `take(200)` window from useQuery, but better than nothing for "live" updates)
  useEffect(() => {
    if (convexOrders && !isOfflineMode && isAuthenticated) {
      const mapped = convexOrders.map(mapOrder);
      // We merge with cache to avoid losing older orders not in the 200 window
      setCachedOrders(prev => {
        const orderMap = new Map(prev.map(o => [o.id, o]));
        mapped.forEach(o => orderMap.set(o.id, o));
        const merged = Array.from(orderMap.values());
        saveOrders(merged);
        return merged;
      });
    }
  }, [convexOrders, isAuthenticated, isOfflineMode]);

  // ... (keep categories/customers sync logic as is, or remove if they were relying on useQuery effects)
  // For categories/customers, we still rely on useQuery effects below unless changed.

  // Determine source of truth based on connectivity
  // We now ALWAYS use cachedProducts as the base, merged with live updates if any
  const products = cachedProducts;
  // (We ignore `convexProducts` since it's disabled)

  const categories = cachedCategories;
  const customers = cachedCustomers;
  const orders = cachedOrders;
  const users = useMemo(() => convexUsers.map(mapUser), [convexUsers]);

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  const activeCategories = useMemo(() => categories.filter(c => c.isActive), [categories]);
  const activeCustomers = useMemo(() => customers.filter(c => c.isActive), [customers]);

  const filteredSortedProducts = useMemo(() => {
    let prods = activeProducts.filter(product => {
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
      prods = [...prods].sort((a, b) => a.basePrice - b.basePrice);
    } else if (sortBy === 'price_high') {
      prods = [...prods].sort((a, b) => b.basePrice - a.basePrice);
    }

    return prods;
  }, [activeProducts, searchQuery, activeFilter, sortBy]);

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getCategoryById = useCallback((id: string) => {
    return categories.find(c => c.id === id);
  }, [categories]);

  const getOrderById = useCallback((id: string) => {
    return orders.find(o => o.id === id);
  }, [orders]);

  const getUserById = useCallback((id: string) => {
    return users.find(u => u.id === id);
  }, [users]);

  const getCustomerById = useCallback((id: string) => {
    return customers.find(c => c.id === id);
  }, [customers]);

  const getOrdersBySalesRep = useCallback((salesRepId: string) => {
    return orders.filter(o => o.salesRepId === salesRepId);
  }, [orders]);

  const getProductsByCategory = useCallback((categoryId: string) => {
    return activeProducts.filter(p => p.categoryId === categoryId);
  }, [activeProducts]);

  const searchProducts = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return activeProducts.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery)
    );
  }, [activeProducts]);

  const resolveImageUri = useCallback((uri: string | null | undefined) => {
    return resolveCachedImageUri(uri, imageCacheIndex);
  }, [imageCacheIndex]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'createdAt'>) => {
    const id = await createProductMutation({
      name: product.name,
      description: product.description,
      sku: product.sku,
      basePrice: product.basePrice,
      images: product.images,
      categoryId: product.categoryId,
      isActive: product.isActive,
      variations: product.variations,
      stock: product.stock,
    });
    return { ...product, id: id as string, createdAt: new Date().toISOString() };
  }, [createProductMutation]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const safeUpdates = withoutId(updates);
    await updateProductMutation({
      id: id as unknown as Id<"products">,
      ...safeUpdates,
    });
  }, [updateProductMutation]);

  const deleteProduct = useCallback(async (id: string) => {
    await removeProductMutation({ id: id as unknown as Id<"products"> });
  }, [removeProductMutation]);

  const addCategory = useCallback(async (category: Omit<Category, 'id' | 'createdAt'>) => {
    const id = await createCategoryMutation({
      name: category.name,
      description: category.description,
      image: category.image,
      parentId: category.parentId,
      isActive: category.isActive,
    });
    return { ...category, id: id as string, createdAt: new Date().toISOString() };
  }, [createCategoryMutation]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    const safeUpdates = withoutId(updates);
    await updateCategoryMutation({
      id: id as unknown as Id<"categories">,
      ...safeUpdates,
    });
  }, [updateCategoryMutation]);

  const addOrder = useCallback(async (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => {
    if (isOfflineMode) {
      console.log('[Data] Offline mode detected. Queuing order...');
      const queuedOrder = await queueOrder(orderData);
      await refreshPendingCount();

      // We can't immediately show it in the orders list unless we mix pending orders
      // But for now, returning it allows the UI to show success
      return {
        ...queuedOrder,
        id: queuedOrder.tempId,
        orderNumber: 'PENDING-SYNC',
        updatedAt: queuedOrder.createdAt
      } as Order;
    }

    const id = await createOrderMutation({
      salesRepId: orderData.salesRepId,
      salesRepName: orderData.salesRepName,
      customerName: orderData.customerName,
      customerPhone: orderData.customerPhone,
      customerEmail: orderData.customerEmail,
      customerAddress: orderData.customerAddress,
      latitude: orderData.latitude,
      longitude: orderData.longitude,
      items: orderData.items,
      subtotal: orderData.subtotal,
      tax: orderData.tax,
      discount: orderData.discount,
      total: orderData.total,
      status: orderData.status,
      notes: orderData.notes,
    });

    const now = new Date().toISOString();
    const orderNumber = `ORD-${new Date().getFullYear()}-${(orders.length + 1).toString().padStart(4, '0')}`;

    console.log('[Data] New order created:', orderNumber);
    showToast('Order placed successfully!', 'success');

    return {
      ...orderData,
      id: id as string,
      orderNumber,
      createdAt: now,
      updatedAt: now,
    };
  }, [createOrderMutation, orders.length, isOfflineMode, refreshPendingCount, showToast]);

  // Sales Rep Notification: Watch for order status updates
  useEffect(() => {
    if (!convexOrders || !user || user.role !== 'sales_rep') return;

    const myOrders = convexOrders.filter(o => o.salesRepId === user.id);
    const currentStatuses = new Map(myOrders.map(o => [o._id, o.status]));

    // Check for statuses changes if we have previous data
    if (prevOrderStatusesRef.current.size > 0) {
      for (const [id, status] of currentStatuses.entries()) {
        const prevStatus = prevOrderStatusesRef.current.get(id);
        if (prevStatus && prevStatus !== status) {
          const order = myOrders.find(o => o._id === id);
          if (order) {
            showToast(`Order #${order.orderNumber} is now ${status}`, 'info');
          }
        }
      }
    } else if (currentStatuses.size > 0) {
      // First load of statuses, just populate ref
    }

    prevOrderStatusesRef.current = currentStatuses;
  }, [convexOrders, user, showToast]);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    if (isOfflineMode) {
      const now = new Date().toISOString();
      const nextOrders = cachedOrders.map(order => (
        order.id === id
          ? {
              ...order,
              status,
              updatedAt: now,
            }
          : order
      ));

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
          changeDescription: `Updated: status`,
        });
      }

      await refreshPendingCount();
      showToast('Order status saved offline. It will sync when online.', 'info');
      return;
    }
    await updateOrderStatusMutation({ id: id as unknown as Id<"orders">, status });
  }, [cachedOrders, isOfflineMode, refreshPendingCount, showToast, updateOrderStatusMutation, user?.id, user?.name]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>, editedBy: string, editedByName: string, changeDescription: string) => {
    const safeUpdates = compactObject(withoutId(updates));
    const effectiveEditedBy = editedBy || user?.id || 'offline-user';
    const effectiveEditedByName = editedByName || user?.name || 'Offline User';

    if (isOfflineMode) {
      const now = new Date().toISOString();
      const localEditEntry = {
        editedAt: now,
        editedBy: effectiveEditedBy,
        editedByName: effectiveEditedByName,
        changes: changeDescription,
      };
      const nextOrders = cachedOrders.map(order => {
        if (order.id !== id) return order;
        return {
          ...order,
          ...safeUpdates,
          updatedAt: now,
          editLog: [...(order.editLog || []), localEditEntry],
        };
      });

      setCachedOrders(nextOrders);
      await saveOrders(nextOrders);

      if (id.startsWith('TEMP-')) {
        await updatePendingOrder(id, safeUpdates as any);
      } else {
        await queueOrderUpdate({
          orderId: id,
          updates: safeUpdates,
          editedBy: effectiveEditedBy,
          editedByName: effectiveEditedByName,
          changeDescription,
        });
      }

      await refreshPendingCount();
      showToast('Order changes saved offline. They will sync when online.', 'info');
      console.log('[Data] Order updated offline:', id, changeDescription);
      return;
    }
    await updateOrderMutation({
      id: id as Id<"orders">,
      editedBy: effectiveEditedBy,
      editedByName: effectiveEditedByName,
      changeDescription,
      ...safeUpdates,
    });
    console.log('[Data] Order updated:', id, changeDescription);
  }, [
    cachedOrders,
    isOfflineMode,
    refreshPendingCount,
    showToast,
    updateOrderMutation,
    user?.id,
    user?.name,
  ]);

  const undoOrderEdit = useCallback(async (id: string) => {
    if (isOfflineMode) return;
    await undoOrderEditMutation({ id: id as Id<"orders"> });
    console.log('[Data] Order edit undone:', id);
  }, [undoOrderEditMutation, isOfflineMode]);

  const deleteOrder = useCallback(async (id: string) => {
    if (isOfflineMode) {
      console.warn('[Data] Cannot delete order while offline');
      showToast('Cannot delete order while offline', 'error');
      return;
    }
    await removeOrderMutation({ id: id as Id<"orders"> });
    showToast('Order deleted successfully', 'success');
    console.log('[Data] Order deleted:', id);
  }, [removeOrderMutation, isOfflineMode, showToast]);

  const syncOrderToEcwid = useCallback(async (id: string) => {
    if (isOfflineMode) {
      showToast('Cannot sync while offline', 'error');
      return;
    }
    try {
      showToast('Syncing to Ecwid...', 'info');
      await pushOrderAction({ orderId: id as Id<"orders"> });
      showToast('Successfully synced to Ecwid', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[Data] Sync failed:', e);
      showToast('Failed to sync to Ecwid', 'error');
    }
  }, [pushOrderAction, isOfflineMode, showToast]);

  const syncOrderStatusToEcwid = useCallback(async (id: string, status: string) => {
    if (isOfflineMode) return;
    try {
      await pushOrderStatusAction({ orderId: id as Id<"orders">, status });
    } catch (e) {
      console.error('[Data] Status sync failed:', e);
    }
  }, [pushOrderStatusAction, isOfflineMode]);

  const addUser = useCallback(async (user: Omit<User, 'id' | 'createdAt'>) => {
    const id = await createUserMutation({
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
    });
    return { ...user, id: id as string, createdAt: new Date().toISOString() };
  }, [createUserMutation]);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    const safeUpdates = withoutId(updates);
    await updateUserMutation({
      id: id as unknown as Id<"users">,
      ...safeUpdates,
    });
  }, [updateUserMutation]);

  const deleteUser = useCallback(async (id: string) => {
    await removeUserMutation({ id: id as unknown as Id<"users"> });
    console.log('[Data] User deleted:', id);
  }, [removeUserMutation]);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    if (isOfflineMode) {
      // Simple offline support: we won't allow creating new customers offline for MVP to avoid ID conflicts
      console.warn('[Data] Cannot create customer while offline');
      throw new Error("Cannot create customers offline in this version");
    }
    const id = await createCustomerMutation({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      latitude: customer.latitude,
      longitude: customer.longitude,
      company: customer.company,
      isActive: customer.isActive,
    });
    return { ...customer, id: id as string, createdAt: new Date().toISOString() };
  }, [createCustomerMutation, isOfflineMode]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    if (isOfflineMode) return;
    const safeUpdates = withoutId(updates);
    await updateCustomerMutation({
      id: id as unknown as Id<"customers">,
      ...safeUpdates,
    });
  }, [updateCustomerMutation, isOfflineMode]);

  const dashboardStats: DashboardStats = useMemo(() => {
    if (!isOfflineMode && convexDashboardStats) {
      return convexDashboardStats;
    }
    // Fallback calculation for offline or loading state
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ordersThisMonth = orders.filter(o => new Date(o.createdAt) >= startOfMonth);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;

    return {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      totalProducts: products.length,
      totalUsers: users.filter(u => u.role === 'sales_rep').length,
      pendingOrders,
      ordersThisMonth: ordersThisMonth.length,
      revenueThisMonth: ordersThisMonth.reduce((sum, o) => sum + o.total, 0),
    };
  }, [convexDashboardStats, orders, products, users, isOfflineMode]);

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
    addCustomer,
    updateCustomer,
    addCategory,
    updateCategory,
    addOrder,
    updateOrderStatus,
    updateOrder,
    undoOrderEdit,
    deleteOrder,
    syncOrderToEcwid,
    syncOrderStatusToEcwid,
    loadCachedDataAndSync,
    isSyncing,
    addUser,
    updateUser,
    deleteUser,
  };
});
