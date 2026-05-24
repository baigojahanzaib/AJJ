import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, Customer, Order, OrderStatus, Product, User } from '@/types';

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed === 'https://e-order.co.za' ? 'https://api.e-order.co.za' : trimmed;
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_BAIGO_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'https://api.e-order.co.za'
);

const ACCESS_TOKEN_KEY = '@baigo_api_access_token';
const REFRESH_TOKEN_KEY = '@baigo_api_refresh_token';

type RequestOptions = RequestInit & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

type Paginated<T> = {
  results?: T[];
  next?: string | null;
};

type FetchListOptions = {
  updatedAfter?: string | null;
};

function joinUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join('&');
  if (!query) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${query}`;
}

async function readAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

async function readRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function saveApiTokens(tokens: { access?: string; refresh?: string }) {
  const writes: Promise<void>[] = [];
  if (tokens.access) writes.push(AsyncStorage.setItem(ACCESS_TOKEN_KEY, tokens.access));
  if (tokens.refresh) writes.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh));
  await Promise.all(writes);
}

export async function clearApiTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await readRefreshToken();
  if (!refresh) return null;

  const response = await fetch(joinUrl('/api/v2/auth/refresh/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    await clearApiTokens();
    return null;
  }

  const data = await response.json();
  await saveApiTokens({ access: data.access, refresh: data.refresh ?? refresh });
  return data.access ?? null;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, retryOnUnauthorized = true, headers, body, ...rest } = options;
  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await readAccessToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(joinUrl(path), {
    ...rest,
    body,
    headers: requestHeaders,
  });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const token = await refreshAccessToken();
    if (token) {
      return apiFetch<T>(path, {
        ...options,
        retryOnUnauthorized: false,
        headers: { ...(headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
      });
    }
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const serverMessage = payload.error || payload.detail || payload.message;
    const fallback = text && !data ? text.replace(/\s+/g, ' ').slice(0, 160) : null;
    const message = typeof serverMessage === 'string'
      ? serverMessage
      : fallback
        ? `Request failed with ${response.status}: ${fallback}`
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function stringId(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function statusFromApi(status: string): OrderStatus {
  return ({
    quotation: 'pending',
    draft: 'pending',
    placed: 'pending',
    confirmed: 'confirmed',
    awaiting_procurement: 'confirmed',
    processing: 'processing',
    ready: 'processing',
    ready_to_deliver: 'processing',
    dispatched: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
    refunded: 'cancelled',
  } as Record<string, OrderStatus>)[status] ?? (status as OrderStatus);
}

export function statusToApi(status: OrderStatus): string {
  return ({
    pending: 'placed',
    confirmed: 'confirmed',
    processing: 'processing',
    shipped: 'dispatched',
    delivered: 'delivered',
    cancelled: 'cancelled',
  } as Record<OrderStatus, string>)[status];
}

export function normalizeProduct(raw: any): Product {
  const compareAtPrice = raw.compareAtPrice ?? raw.compare_at_price;
  return {
    id: stringId(raw.id),
    name: raw.name ?? '',
    description: raw.description ?? '',
    sku: raw.sku ?? '',
    basePrice: numberValue(raw.basePrice ?? raw.base_price ?? raw.starting_price),
    compareAtPrice: compareAtPrice === null || compareAtPrice === undefined
      ? undefined
      : numberValue(compareAtPrice),
    images: Array.isArray(raw.images) ? raw.images.filter(Boolean) : [raw.external_image_url].filter(Boolean),
    categoryId: stringId(raw.categoryId ?? raw.category_id),
    isActive: Boolean(raw.isActive ?? raw.is_visible ?? true),
    variations: Array.isArray(raw.variations) ? raw.variations : [],
    combinations: Array.isArray(raw.combinations) ? raw.combinations : undefined,
    stock: numberValue(raw.stock),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    moq: raw.moq === null || raw.moq === undefined ? undefined : numberValue(raw.moq),
    ecwidId: raw.ecwidId ?? raw.ecwid_id,
    ribbon: raw.ribbon ?? undefined,
    ribbonColor: raw.ribbonColor ?? raw.ribbon_color ?? undefined,
  };
}

export function normalizeCategory(raw: any): Category {
  return {
    id: stringId(raw.id),
    name: raw.name ?? '',
    description: raw.description ?? '',
    image: raw.image ?? undefined,
    parentId: raw.parentId ? stringId(raw.parentId) : undefined,
    isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    ecwidId: raw.ecwidId ?? raw.ecwid_id,
  };
}

export function normalizeCustomer(raw: any): Customer {
  return {
    id: stringId(raw.id),
    name: raw.name ?? raw.full_name ?? raw.company_name ?? `Customer #${raw.id}`,
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    address: raw.address ?? '',
    company: raw.company ?? raw.company_name ?? undefined,
    isActive: Boolean(raw.isActive ?? true),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    ecwidId: raw.ecwidId ?? raw.erp_customer_id,
  };
}

export function normalizeUser(raw: any): User {
  return {
    id: stringId(raw.id),
    email: raw.email ?? '',
    password: '',
    name: raw.name ?? [raw.first_name, raw.last_name].filter(Boolean).join(' ') ?? raw.email ?? '',
    role: raw.role ?? (raw.is_staff ? 'sales_rep' : 'client'),
    phone: raw.phone ?? '',
    avatar: raw.avatar ?? undefined,
    isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
    createdAt: raw.createdAt ?? raw.date_joined ?? new Date().toISOString(),
    customerId: raw.customerId ? stringId(raw.customerId) : undefined,
  };
}

export function normalizeOrder(raw: any): Order {
  const address = raw.customerAddress ?? [
    raw.ship_line1, raw.ship_line2, raw.ship_suburb, raw.ship_city,
    raw.ship_province, raw.ship_postal_code,
  ].filter(Boolean).join(', ');

  return {
    id: stringId(raw.id),
    orderNumber: raw.orderNumber ?? raw.number ?? '',
    salesRepId: stringId(raw.salesRepId ?? raw.sales_rep_id),
    salesRepName: raw.salesRepName ?? '',
    orderSource: raw.orderSource ?? ({ online: 'client_shop', rep: 'sales_rep', admin: 'admin' } as any)[raw.source],
    clientUserId: raw.clientUserId ? stringId(raw.clientUserId) : undefined,
    customerId: raw.customerId ?? (raw.customer_id ? stringId(raw.customer_id) : undefined),
    placedByUserId: raw.placedByUserId ? stringId(raw.placedByUserId) : undefined,
    customerName: raw.customerName ?? raw.customer_name ?? '',
    customerPhone: raw.customerPhone ?? raw.customer_phone ?? '',
    customerEmail: raw.customerEmail ?? raw.customer_email ?? '',
    customerAddress: address,
    latitude: raw.latitude ?? raw.ship_gps_lat ?? undefined,
    longitude: raw.longitude ?? raw.ship_gps_lng ?? undefined,
    items: (raw.items ?? []).map((item: any) => ({
      id: stringId(item.id),
      productId: stringId(item.productId ?? item.variant_id),
      productName: item.productName ?? item.name ?? '',
      productSku: item.productSku ?? item.sku ?? '',
      productImage: item.productImage ?? '',
      selectedVariations: item.selectedVariations ?? [],
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unitPrice ?? item.unit_price_ex_vat),
      totalPrice: numberValue(item.totalPrice ?? item.line_subtotal_ex_vat ?? item.line_total_inc_vat),
    })),
    subtotal: numberValue(raw.subtotal ?? raw.subtotal_ex_vat),
    tax: numberValue(raw.tax ?? raw.vat_amount),
    discount: numberValue(raw.discount ?? raw.discount_amount),
    total: numberValue(raw.total ?? raw.total_inc_vat),
    status: statusFromApi(raw.status ?? 'placed'),
    notes: raw.notes ?? raw.notes_customer ?? '',
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

async function collectPaginated<T>(
  path: string,
  mapper: (value: any) => T,
  options: { auth?: boolean } = {}
): Promise<T[]> {
  const first = await apiFetch<Paginated<any> | any[]>(path, { auth: options.auth });
  if (Array.isArray(first)) return first.map(mapper);

  const rows: T[] = (first.results ?? []).map(mapper);
  let next = first.next;
  while (next) {
    const page = await apiFetch<Paginated<any>>(next, { auth: options.auth });
    rows.push(...(page.results ?? []).map(mapper));
    next = page.next;
  }
  return rows;
}

export async function loginWithApi(email: string, password: string): Promise<User> {
  const data = await apiFetch<{ access: string; refresh: string; user: any }>('/api/v2/auth/jwt/', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ username: email, password }),
  });
  await saveApiTokens(data);
  return normalizeUser(data.user);
}

export async function registerWithApi(input: { name: string; email: string; phone: string; password: string }): Promise<User> {
  const data = await apiFetch<{ access: string; refresh: string; user: any }>('/api/v2/auth/register/', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(input),
  });
  await saveApiTokens(data);
  return normalizeUser(data.user);
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = await readAccessToken();
  if (!token) return null;
  try {
    const data = await apiFetch<any>('/api/auth/me/');
    return normalizeUser(data.mobile_user ?? data);
  } catch {
    return null;
  }
}

export async function logoutFromApi() {
  const refresh = await readRefreshToken();
  try {
    await apiFetch('/api/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh }),
    });
  } finally {
    await clearApiTokens();
  }
}

export const fetchProducts = (options: FetchListOptions = {}) => (
  collectPaginated(
    withQuery('/api/mobile/products/', { updated_after: options.updatedAfter }),
    normalizeProduct,
    { auth: false }
  )
);
export const fetchCategories = (options: FetchListOptions = {}) => (
  collectPaginated(
    withQuery('/api/mobile/categories/', { updated_after: options.updatedAfter }),
    normalizeCategory,
    { auth: false }
  )
);
export const fetchCustomers = (options: FetchListOptions = {}) => (
  collectPaginated(
    withQuery('/api/customers/', { updated_after: options.updatedAfter, page_size: '250' }),
    normalizeCustomer
  )
);
export const fetchOrders = (options: FetchListOptions = {}) => (
  collectPaginated(
    withQuery('/api/orders/', { updated_after: options.updatedAfter, page_size: '100' }),
    normalizeOrder
  )
);
export async function fetchUsers(options: FetchListOptions = {}): Promise<User[]> {
  const data = await apiFetch<{ results: any[] }>(
    withQuery('/api/v2/users/', { updated_after: options.updatedAfter })
  );
  return (data.results ?? []).map(normalizeUser);
}

export async function fetchAppConfig() {
  return apiFetch<any>('/api/config/');
}

export async function updateAppConfig(payload: Record<string, unknown>) {
  return apiFetch<any>('/api/config/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createProduct(input: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
  return normalizeProduct(await apiFetch('/api/products/create/', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  return normalizeProduct(await apiFetch(`/api/products/${id}/update/`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }));
}

export async function deleteProduct(id: string) {
  await apiFetch(`/api/products/${id}/delete/`, { method: 'DELETE' });
}

export async function createCategory(input: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
  return normalizeCategory(await apiFetch('/api/categories/create/', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
  return normalizeCategory(await apiFetch(`/api/categories/${id}/update/`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }));
}

export async function createCustomer(input: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
  return normalizeCustomer(await apiFetch('/api/customers/create/', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
  return normalizeCustomer(await apiFetch(`/api/customers/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }));
}

export async function createUser(input: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  return normalizeUser(await apiFetch('/api/v2/users/create/', {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  return normalizeUser(await apiFetch(`/api/v2/users/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }));
}

export async function deleteUser(id: string) {
  await apiFetch(`/api/v2/users/${id}/delete/`, { method: 'DELETE' });
}

export async function createOrder(payload: Record<string, unknown>, idempotencyKey: string): Promise<Order> {
  return normalizeOrder(await apiFetch('/api/orders/create/', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  }));
}

export async function updateOrder(orderNumber: string, updates: Partial<Order>, changeDescription?: string): Promise<Order> {
  return normalizeOrder(await apiFetch(`/api/orders/${encodeURIComponent(orderNumber)}/update/`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, changeDescription }),
  }));
}

export async function updateOrderStatus(orderNumber: string, status: OrderStatus): Promise<Order> {
  return normalizeOrder(await apiFetch(`/api/orders/${encodeURIComponent(orderNumber)}/status/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }));
}

export async function deleteOrder(orderNumber: string) {
  await apiFetch(`/api/orders/${encodeURIComponent(orderNumber)}/delete/`, { method: 'DELETE' });
}

export async function uploadFile(asset: { uri: string; fileName?: string | null; mimeType?: string | null }): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `upload-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  } as any);
  const data = await apiFetch<{ url: string }>('/api/files/upload/', {
    method: 'POST',
    body: formData,
  });
  return data.url;
}

export function createIdempotencyKey(): string {
  const random = Math.random().toString(36).slice(2);
  return `mobile-${Date.now()}-${random}`;
}
