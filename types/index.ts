export type UserRole = 'admin' | 'sales_rep';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone: string;
  avatar?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface VariationOption {
  id: string;
  name: string;
  priceModifier: number;
  sku: string;
  stock: number;
  image?: string;
  moq?: number;
}

export interface ProductVariation {
  id: string;
  name: string;
  options: VariationOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  basePrice: number;
  compareAtPrice?: number;
  images: string[];
  categoryId: string;
  isActive: boolean;
  variations: ProductVariation[];
  stock: number;
  createdAt: string;
  moq?: number;
  // Ecwid ribbon/promotion tag
  ribbon?: string;
  ribbonColor?: string;
}

export interface SelectedVariation {
  variationId: string;
  variationName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
}

export interface CartItem {
  id: string;
  product: Product;
  selectedVariations: SelectedVariation[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage: string;
  selectedVariations: SelectedVariation[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderEditLog {
  editedAt: string;
  editedBy: string;
  editedByName: string;
  changes: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  salesRepId: string;
  salesRepName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  latitude?: number;
  longitude?: number;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  previousVersion?: Omit<Order, 'previousVersion'>;
  editLog?: OrderEditLog[];
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalUsers: number;
  pendingOrders: number;
  ordersThisMonth: number;
  revenueThisMonth: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  latitude?: number;
  longitude?: number;
  company?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
