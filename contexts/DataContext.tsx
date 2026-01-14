import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { Product, Category, Order, User, DashboardStats, OrderEditLog } from '@/types';
import { mockProducts } from '@/mocks/products';
import { mockCategories } from '@/mocks/categories';
import { mockOrders, generateOrderNumber } from '@/mocks/orders';
import { mockUsers } from '@/mocks/users';

export const [DataProvider, useData] = createContextHook(() => {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [users, setUsers] = useState<User[]>(mockUsers);

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

  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setProducts(prev => [...prev, newProduct]);
    return newProduct;
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const addCategory = useCallback((category: Omit<Category, 'id' | 'createdAt'>) => {
    const newCategory: Category = {
      ...category,
      id: `cat-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const addOrder = useCallback((orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderNumber: generateOrderNumber(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setOrders(prev => [...prev, newOrder]);
    console.log('[Data] New order created:', newOrder.orderNumber);
    return newOrder;
  }, []);

  const updateOrderStatus = useCallback((id: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o));
  }, []);

  const updateOrder = useCallback((id: string, updates: Partial<Order>, editedBy: string, editedByName: string, changeDescription: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      
      const { previousVersion: _, editLog: __, ...currentOrderWithoutHistory } = o;
      
      const newEditLog: OrderEditLog = {
        editedAt: new Date().toISOString(),
        editedBy,
        editedByName,
        changes: changeDescription,
      };
      
      return {
        ...o,
        ...updates,
        updatedAt: new Date().toISOString(),
        previousVersion: currentOrderWithoutHistory as Omit<Order, 'previousVersion'>,
        editLog: [...(o.editLog || []), newEditLog],
      };
    }));
    console.log('[Data] Order updated:', id, changeDescription);
  }, []);

  const undoOrderEdit = useCallback((id: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id || !o.previousVersion) return o;
      
      const restoredOrder: Order = {
        ...o.previousVersion,
        updatedAt: new Date().toISOString(),
        editLog: o.editLog?.slice(0, -1),
        previousVersion: undefined,
      };
      
      console.log('[Data] Order edit undone:', id);
      return restoredOrder;
    }));
  }, []);

  const addUser = useCallback((user: Omit<User, 'id' | 'createdAt'>) => {
    const newUser: User = {
      ...user,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  }, []);

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  }, []);

  const dashboardStats: DashboardStats = useMemo(() => {
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
  }, [orders, products, users]);

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
