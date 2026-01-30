import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Product, Category, Order, User, Customer, DashboardStats, OrderEditLog, OrderStatus } from '@/types';
import { Id } from '../convex/_generated/dataModel';
import {
  saveProducts, getCachedProducts,
  saveCategories, getCachedCategories,
  saveCustomers, getCachedCustomers,
  saveOrders, getCachedOrders
} from '../lib/offline-storage';
import { queueOrder } from '../lib/sync-manager';
import { useOffline } from './OfflineContext';

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

import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

export type CatalogSortOption = 'default' | 'price_low' | 'price_high';
export type CatalogFilter = { type: 'all' | 'category' | 'ribbon'; id: string | null };

export const [DataProvider, useData] = createContextHook(() => {
  const { isOfflineMode, refreshPendingCount } = useOffline();
  const { showToast } = useNotification();
  const { user, isAdmin } = useAuth();

  // Local state for offline data
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([]);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);

  // Catalog Shared State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CatalogFilter>({ type: 'all', id: null });
  const [sortBy, setSortBy] = useState<CatalogSortOption>('default');

  // Track previous orders for notifications
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const prevOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const isOrdersInitializedRef = useRef(false);

  // Manual sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Convex queries (Skip standard 'list' to avoid huge payload)
  // We use direct client.query() for sync instead.
  // const convexProducts = useQuery(api.products.list); // DISABLED

  // Keep other queries that are small enough or needed live
  const convexCategories = useQuery(api.categories.list);
  const convexOrders = useQuery(api.orders.list); // This is now optimized with take(200)
  const convexUsers = useQuery(api.users.list) ?? [];
  // const convexCustomers = useQuery(api.customers.list); // DISABLED
  const convexCustomers = undefined;
  const convexDashboardStats = useQuery(api.orders.getDashboardStats);

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
  const createUserMutation = useMutation(api.users.create);
  const updateUserMutation = useMutation(api.users.update);
  const removeUserMutation = useMutation(api.users.remove);
  const createCustomerMutation = useMutation(api.customers.create);
  const updateCustomerMutation = useMutation(api.customers.update);

  const { useAction } = require("convex/react");
  const pushOrderAction = useAction(api.ecwid.syncOrderToEcwid);
  const pushOrderStatusAction = useAction(api.ecwid.syncOrderStatusToEcwid);

  // Use the Convex client directly for manual fetches
  const { useConvex } = require("convex/react");
  const convex = useConvex();

  // Load cached data on mount AND trigger delta sync
  useEffect(() => {
    loadCachedDataAndSync();
  }, [isOfflineMode]);

  const loadCachedDataAndSync = async () => {
    try {
      console.log('[Data] Loading cached data...');
      const [p, c, cust, o] = await Promise.all([
        getCachedProducts(),
        getCachedCategories(),
        getCachedCustomers(),
        getCachedOrders()
      ]);
      setCachedProducts(p);
      setCachedCategories(c);
      setCachedCustomers(cust);
      setCachedOrders(o);

      console.log(`[Data] Loaded ${p.length} products from cache.`);

      if (!isOfflineMode) {
        syncData(p, cust);
      }
    } catch (error) {
      console.error('[Data] Error loading cache:', error);
    }
  };

  const syncData = async (currentCache: Product[], currentCustCache: Customer[]) => {
    if (isSyncing) return;
    setIsSyncing(true);
    console.log('[Data] Starting Delta Sync...');

    try {
      // Simple strategy: Fetch ALL active products (paginated) if cache is empty
      // Or fetch updates if cache exists? 
      // For now, let's just fetch the latest 200 via `sync` and merge?
      // User wants "cache once then only cache changes".
      // We lack a robust "lastSyncTime" persistence in this context (it's in offline-storage but not exposed here easily).
      // Let's assume we fetch *everything* in batches until done if cache is empty.
      // If cache is NOT empty, we still need to know what changed.
      // Without a "last_updated" tracking, we might miss deletions.
      // But let's start with a "Fetch All Batched" approach to ensure consistency first, 
      // as "Delta" requires reliable cursors. 
      // ACTUALLY, sticking to the user's request:
      // We will just fetch `api.products.list` (which is now paginated) 
      // but we need ALL pages. So we loop.

      let allProducts = [...currentCache];
      const productMap = new Map(allProducts.map(p => [p.id, p]));

      // 1. Paginated Sync Products
      let productCursor: string | null = null;
      let productDone = false;
      let syncCount = 0;

      while (!productDone && syncCount < 20) { // Safety limit of 20 pages (4000 products)
        const result = await convex.query(api.products.list, {
          cursor: productCursor || undefined,
          limit: 200
        });

        if (result && result.page) {
          result.page.map(mapProduct).forEach(p => productMap.set(p.id, p));
          productCursor = result.continueCursor;
          productDone = result.isDone;
          syncCount++;
        } else {
          productDone = true;
        }
      }

      const merged = Array.from(productMap.values());
      setCachedProducts(merged);
      saveProducts(merged);
      console.log(`[Data] Sync complete. Total products: ${merged.length} (${syncCount} pages)`);

      // 2. Paginated Sync Customers
      let custMap = new Map(currentCustCache.map(c => [c.id, c]));
      let custCursor: string | null = null;
      let custDone = false;
      let custSyncCount = 0;

      while (!custDone && custSyncCount < 20) {
        const result = await convex.query(api.customers.list, {
          cursor: custCursor || undefined,
          limit: 200
        });

        if (result && result.page) {
          result.page.map(mapCustomer).forEach(c => custMap.set(c.id, c));
          custCursor = result.continueCursor;
          custDone = result.isDone;
          custSyncCount++;
        } else {
          custDone = true;
        }
      }

      const mergedCust = Array.from(custMap.values());
      setCachedCustomers(mergedCust);
      saveCustomers(mergedCust);
      console.log(`[Data] Customer Sync complete. Total: ${mergedCust.length} (${custSyncCount} pages)`);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // ... (keep categories/customers sync logic as is, or remove if they were relying on useQuery effects)
  // For categories/customers, we still rely on useQuery effects below unless changed.

  // Determine source of truth based on connectivity
  // We now ALWAYS use cachedProducts as the base, merged with live updates if any
  const products = cachedProducts;
  // (We ignore `convexProducts` since it's disabled)

  const categories = useMemo(() => {
    if (convexCategories === undefined || isOfflineMode) return cachedCategories;
    return convexCategories.map(mapCategory);
  }, [convexCategories, isOfflineMode, cachedCategories]);

  const customers = cachedCustomers;

  const orders = useMemo(() => {
    if (convexOrders === undefined || isOfflineMode) return cachedOrders;
    return convexOrders.map(mapOrder);
  }, [convexOrders, isOfflineMode, cachedOrders]);

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
    await updateProductMutation({
      id: id as unknown as Id<"products">,
      ...updates,
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
    await updateCategoryMutation({
      id: id as unknown as Id<"categories">,
      ...updates,
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
      console.warn('[Data] Cannot update order status while offline');
      return;
    }
    await updateOrderStatusMutation({ id: id as unknown as Id<"orders">, status });
  }, [updateOrderStatusMutation, isOfflineMode]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>, editedBy: string, editedByName: string, changeDescription: string) => {
    if (isOfflineMode) {
      console.warn('[Data] Cannot edit order while offline');
      return;
    }
    await updateOrderMutation({
      id: id as Id<"orders">,
      editedBy,
      editedByName,
      changeDescription,
      ...updates,
    });
    console.log('[Data] Order updated:', id, changeDescription);
  }, [updateOrderMutation, isOfflineMode]);

  const undoOrderEdit = useCallback(async (id: string) => {
    if (isOfflineMode) return;
    await undoOrderEditMutation({ id: id as Id<"orders"> });
    console.log('[Data] Order edit undone:', id);
  }, [undoOrderEditMutation, isOfflineMode]);

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
    await updateUserMutation({
      id: id as unknown as Id<"users">,
      ...updates,
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
    await updateCustomerMutation({
      id: id as unknown as Id<"customers">,
      ...updates,
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
    syncOrderToEcwid,
    syncOrderStatusToEcwid,
    loadCachedDataAndSync,
    isSyncing,
    addUser,
    updateUser,
    deleteUser,
  };
});
