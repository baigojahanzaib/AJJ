import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Product, Category, Order, User, Customer, DashboardStats, OrderEditLog } from '@/types';
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
    company: doc.company,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
  };
}

import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

export const [DataProvider, useData] = createContextHook(() => {
  const { isOfflineMode, refreshPendingCount } = useOffline();
  const { showToast } = useNotification();
  const { user, isAdmin } = useAuth();

  // Local state for offline data
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([]);
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);

  // Track previous orders for notifications
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const prevOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const isOrdersInitializedRef = useRef(false);

  // Convex queries (Skip when offline to avoid errors/retries if possible, though Convex handles this gracefully usually)
  const convexProducts = useQuery(api.products.list);
  const convexCategories = useQuery(api.categories.list);
  const convexOrders = useQuery(api.orders.list);
  const convexUsers = useQuery(api.users.list) ?? [];
  const convexCustomers = useQuery(api.customers.list);
  const convexDashboardStats = useQuery(api.orders.getDashboardStats);

  // Admin Notification: Watch for new orders
  useEffect(() => {
    if (!convexOrders || !isAdmin) return;

    const currentIds = new Set(convexOrders.map(o => o._id));

    // If not initialized, just populate the ref
    if (!isOrdersInitializedRef.current) {
      if (convexOrders.length > 0) {
        prevOrderIdsRef.current = currentIds;
        isOrdersInitializedRef.current = true;
      }
      return;
    }

    // Check for new IDs
    let hasNewOrders = false;
    for (const id of currentIds) {
      if (!prevOrderIdsRef.current.has(id)) {
        hasNewOrders = true;
        break;
      }
    }

    if (hasNewOrders) {
      showToast('New Order Received', 'info');
    }

    prevOrderIdsRef.current = currentIds;
  }, [convexOrders, isAdmin, showToast]);

  // Convex mutations
  const createProductMutation = useMutation(api.products.create);
  const updateProductMutation = useMutation(api.products.update);
  const removeProductMutation = useMutation(api.products.remove);
  const createCategoryMutation = useMutation(api.categories.create);
  const updateCategoryMutation = useMutation(api.categories.update);
  const createOrderMutation = useMutation(api.orders.create);
  const updateOrderStatusMutation = useMutation(api.orders.updateStatus);
  const updateOrderMutation = useMutation(api.orders.update);
  const undoOrderEditMutation = useMutation(api.orders.undoEdit);
  const createUserMutation = useMutation(api.users.create);
  const updateUserMutation = useMutation(api.users.update);
  const removeUserMutation = useMutation(api.users.remove);

  const createCustomerMutation = useMutation(api.customers.create);
  const updateCustomerMutation = useMutation(api.customers.update);

  // Load cached data on mount
  useEffect(() => {
    loadCachedData();
  }, []);

  const loadCachedData = async () => {
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
      console.log(`[Data] Loaded ${p.length} products, ${c.length} cats, ${cust.length} customers, ${o.length} orders from cache`);
    } catch (error) {
      console.error('[Data] Error loading cache:', error);
    }
  };

  // Sync data to cache when online and regular queries update
  useEffect(() => {
    if (convexProducts) {
      const mapped = convexProducts.map(mapProduct);
      saveProducts(mapped);
      setCachedProducts(mapped);
    }
  }, [convexProducts]);

  useEffect(() => {
    if (convexCategories) {
      const mapped = convexCategories.map(mapCategory);
      saveCategories(mapped);
      setCachedCategories(mapped);
    }
  }, [convexCategories]);

  useEffect(() => {
    if (convexCustomers) {
      const mapped = convexCustomers.map(mapCustomer);
      saveCustomers(mapped);
      setCachedCustomers(mapped);
    }
  }, [convexCustomers]);

  useEffect(() => {
    if (convexOrders) {
      const mapped = convexOrders.map(mapOrder);
      saveOrders(mapped);
      setCachedOrders(mapped);
    }
  }, [convexOrders]);


  // Determine source of truth based on connectivity
  // If offline OR if Convex queries are still loading (undefined), fall back to cache
  const products = useMemo(() => {
    if (convexProducts === undefined || isOfflineMode) return cachedProducts;
    return convexProducts.map(mapProduct);
  }, [convexProducts, isOfflineMode, cachedProducts]);

  const categories = useMemo(() => {
    if (convexCategories === undefined || isOfflineMode) return cachedCategories;
    return convexCategories.map(mapCategory);
  }, [convexCategories, isOfflineMode, cachedCategories]);

  const customers = useMemo(() => {
    if (convexCustomers === undefined || isOfflineMode) return cachedCustomers;
    return convexCustomers.map(mapCustomer);
  }, [convexCustomers, isOfflineMode, cachedCustomers]);

  const orders = useMemo(() => {
    if (convexOrders === undefined || isOfflineMode) return cachedOrders;
    return convexOrders.map(mapOrder);
  }, [convexOrders, isOfflineMode, cachedOrders]);

  const users = useMemo(() => convexUsers.map(mapUser), [convexUsers]);

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  const activeCategories = useMemo(() => categories.filter(c => c.isActive), [categories]);
  const activeCustomers = useMemo(() => customers.filter(c => c.isActive), [customers]);

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
    addUser,
    updateUser,
    deleteUser,
  };
});
