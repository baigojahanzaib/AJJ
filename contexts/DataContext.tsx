import { useState, useCallback, useMemo, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Product, Category, Order, User, DashboardStats, OrderEditLog } from '@/types';
import { Id } from '../convex/_generated/dataModel';

// Helper to map Convex document to our types
function mapProduct(doc: any): Product {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    sku: doc.sku,
    basePrice: doc.basePrice,
    images: doc.images,
    categoryId: doc.categoryId,
    isActive: doc.isActive,
    variations: doc.variations,
    stock: doc.stock,
    createdAt: doc.createdAt,
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

export const [DataProvider, useData] = createContextHook(() => {
  // Convex queries
  const convexProducts = useQuery(api.products.list) ?? [];
  const convexCategories = useQuery(api.categories.list) ?? [];
  const convexOrders = useQuery(api.orders.list) ?? [];
  const convexUsers = useQuery(api.users.list) ?? [];
  const convexDashboardStats = useQuery(api.orders.getDashboardStats);

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

  // Map Convex data to our types
  const products = useMemo(() => convexProducts.map(mapProduct), [convexProducts]);
  const categories = useMemo(() => convexCategories.map(mapCategory), [convexCategories]);
  const orders = useMemo(() => convexOrders.map(mapOrder), [convexOrders]);
  const users = useMemo(() => convexUsers.map(mapUser), [convexUsers]);

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
  const activeCategories = useMemo(() => categories.filter(c => c.isActive), [categories]);

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
      id: id as Id<"products">,
      ...updates,
    });
  }, [updateProductMutation]);

  const deleteProduct = useCallback(async (id: string) => {
    await removeProductMutation({ id: id as Id<"products"> });
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
      id: id as Id<"categories">,
      ...updates,
    });
  }, [updateCategoryMutation]);

  const addOrder = useCallback(async (orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => {
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
    return {
      ...orderData,
      id: id as string,
      orderNumber,
      createdAt: now,
      updatedAt: now,
    };
  }, [createOrderMutation, orders.length]);

  const updateOrderStatus = useCallback(async (id: string, status: Order['status']) => {
    await updateOrderStatusMutation({
      id: id as Id<"orders">,
      status,
    });
  }, [updateOrderStatusMutation]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>, editedBy: string, editedByName: string, changeDescription: string) => {
    await updateOrderMutation({
      id: id as Id<"orders">,
      editedBy,
      editedByName,
      changeDescription,
      ...updates,
    });
    console.log('[Data] Order updated:', id, changeDescription);
  }, [updateOrderMutation]);

  const undoOrderEdit = useCallback(async (id: string) => {
    await undoOrderEditMutation({ id: id as Id<"orders"> });
    console.log('[Data] Order edit undone:', id);
  }, [undoOrderEditMutation]);

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
      id: id as Id<"users">,
      ...updates,
    });
  }, [updateUserMutation]);

  const dashboardStats: DashboardStats = useMemo(() => {
    if (convexDashboardStats) {
      return convexDashboardStats;
    }
    // Fallback calculation if query hasn't loaded yet
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
  }, [convexDashboardStats, orders, products, users]);

  return {
    products,
    categories,
    orders,
    users,
    activeProducts,
    activeCategories,
    dashboardStats,
    getProductById,
    getCategoryById,
    getOrderById,
    getUserById,
    getOrdersBySalesRep,
    getProductsByCategory,
    searchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    updateCategory,
    addOrder,
    updateOrderStatus,
    updateOrder,
    undoOrderEdit,
    addUser,
    updateUser,
  };
});
