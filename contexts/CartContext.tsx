import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { CartItem, Product, SelectedVariation } from '@/types';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  calculateProductUnitPrice,
  getSelectionKey,
  resolveSelectedVariations
} from '@/lib/product-pricing';

const CART_STORAGE_KEY_PREFIX = '@salesapp_cart_draft';
const GUEST_CART_STORAGE_KEY = `${CART_STORAGE_KEY_PREFIX}:guest`;

const createEmptyCustomerInfo = () => ({
  name: '',
  phone: '',
  email: '',
  address: '',
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
});

type CartDraft = {
  version: 1;
  updatedAt: string;
  items: CartItem[];
  customerInfo: ReturnType<typeof createEmptyCustomerInfo>;
  notes: string;
};

export const [CartProvider, useCart] = createContextHook(() => {
  const { taxSettings } = useRemoteConfig();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { products } = useData();
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState(createEmptyCustomerInfo);
  const [notes, setNotes] = useState('');
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

  const cartStorageKey = user?.id ? `${CART_STORAGE_KEY_PREFIX}:${user.id}` : GUEST_CART_STORAGE_KEY;

  useEffect(() => {
    let isMounted = true;

    const loadCartDraft = async () => {
      setHasHydratedDraft(false);
      setHydratedStorageKey(null);

      if (isAuthLoading) return;

      try {
        const rawDraft = await AsyncStorage.getItem(cartStorageKey);
        const guestDraft = isAuthenticated && cartStorageKey !== GUEST_CART_STORAGE_KEY
          ? await AsyncStorage.getItem(GUEST_CART_STORAGE_KEY)
          : null;
        if (!isMounted) return;

        const effectiveDraft = rawDraft || guestDraft;

        if (!effectiveDraft) {
          setItems([]);
          setCustomerInfo(createEmptyCustomerInfo());
          setNotes('');
          return;
        }

        const parsed = JSON.parse(effectiveDraft) as Partial<CartDraft>;
        setItems(Array.isArray(parsed.items) ? parsed.items : []);
        setCustomerInfo({
          ...createEmptyCustomerInfo(),
          ...(parsed.customerInfo ?? {}),
        });
        setNotes(typeof parsed.notes === 'string' ? parsed.notes : '');

        if (!rawDraft && guestDraft && cartStorageKey !== GUEST_CART_STORAGE_KEY) {
          await AsyncStorage.setItem(cartStorageKey, guestDraft);
          await AsyncStorage.removeItem(GUEST_CART_STORAGE_KEY);
        }
      } catch (error) {
        console.error('[Cart] Error loading saved cart draft:', error);
        if (isMounted) {
          setItems([]);
          setCustomerInfo(createEmptyCustomerInfo());
          setNotes('');
        }
      } finally {
        if (isMounted) {
          setHydratedStorageKey(cartStorageKey);
          setHasHydratedDraft(true);
        }
      }
    };

    loadCartDraft();

    return () => {
      isMounted = false;
    };
  }, [cartStorageKey, isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (!hasHydratedDraft || hydratedStorageKey !== cartStorageKey) return;

    const hasCustomerInfo = Object.values(customerInfo).some(value => value !== undefined && value !== '');
    const hasDraft = items.length > 0 || hasCustomerInfo || notes.trim().length > 0;

    const persistCartDraft = async () => {
      try {
        if (!hasDraft) {
          await AsyncStorage.removeItem(cartStorageKey);
          return;
        }

        const draft: CartDraft = {
          version: 1,
          updatedAt: new Date().toISOString(),
          items,
          customerInfo,
          notes,
        };

        await AsyncStorage.setItem(cartStorageKey, JSON.stringify(draft));
      } catch (error) {
        console.error('[Cart] Error saving cart draft:', error);
      }
    };

    persistCartDraft();
  }, [cartStorageKey, customerInfo, hasHydratedDraft, hydratedStorageKey, items, notes]);

  useEffect(() => {
    if (products.length === 0) return;

    const latestProductsById = new Map(products.map(product => [product.id, product]));

    setItems(prev => {
      let changed = false;

      const nextItems = prev.map(item => {
        const latestProduct = latestProductsById.get(item.product.id);
        if (!latestProduct) return item;

        const previousCalculatedPrice = calculateProductUnitPrice(item.product, item.selectedVariations);
        const hasManualPrice = Math.abs(item.unitPrice - previousCalculatedPrice) > 0.01;
        const selectedVariations = resolveSelectedVariations(latestProduct, item.selectedVariations);
        const unitPrice = hasManualPrice
          ? item.unitPrice
          : calculateProductUnitPrice(latestProduct, selectedVariations);
        const totalPrice = unitPrice * item.quantity;
        const selectionChanged = getSelectionKey(selectedVariations) !== getSelectionKey(item.selectedVariations);

        if (
          latestProduct === item.product &&
          !selectionChanged &&
          Math.abs(unitPrice - item.unitPrice) <= 0.01 &&
          Math.abs(totalPrice - item.totalPrice) <= 0.01
        ) {
          return item;
        }

        changed = true;
        return {
          ...item,
          product: latestProduct,
          selectedVariations,
          unitPrice,
          totalPrice,
        };
      });

      return changed ? nextItems : prev;
    });
  }, [products]);

  const addItem = useCallback((product: Product, selectedVariations: SelectedVariation[], quantity: number = 1) => {
    console.log('[Cart] Adding item:', product.name, 'quantity:', quantity);

    setItems(prev => {
      const resolvedVariations = resolveSelectedVariations(product, selectedVariations);
      const variationKey = getSelectionKey(resolvedVariations);
      const existingIndex = prev.findIndex(item =>
        item.product.id === product.id &&
        getSelectionKey(item.selectedVariations) === variationKey
      );

      const unitPrice = calculateProductUnitPrice(product, resolvedVariations);

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          unitPrice,
          quantity: newQuantity,
          totalPrice: unitPrice * newQuantity,
        };
        return updated;
      }

      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        product,
        selectedVariations: resolvedVariations,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };

      return [...prev, newItem];
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    console.log('[Cart] Updating quantity for item:', itemId, 'to:', quantity);

    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity,
          totalPrice: item.unitPrice * quantity,
        };
      }
      return item;
    }));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    console.log('[Cart] Removing item:', itemId);
    setItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const updateItemPrice = useCallback((itemId: string, newUnitPrice: number) => {
    console.log('[Cart] Updating price for item:', itemId, 'to:', newUnitPrice);
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          unitPrice: newUnitPrice,
          totalPrice: newUnitPrice * item.quantity,
        };
      }
      return item;
    }));
  }, []);

  const clearCart = useCallback(() => {
    console.log('[Cart] Clearing cart');
    setItems([]);
    setCustomerInfo(createEmptyCustomerInfo());
    setNotes('');
    if (cartStorageKey) {
      AsyncStorage.removeItem(cartStorageKey).catch(error => {
        console.error('[Cart] Error clearing saved cart draft:', error);
      });
    }
  }, [cartStorageKey]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const tax = useMemo(() => {
    if (!taxSettings.enabled) return 0;
    return subtotal * taxSettings.rate;
  }, [subtotal, taxSettings.enabled, taxSettings.rate]);

  const total = useMemo(() => {
    return subtotal + tax;
  }, [subtotal, tax]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return {
    items,
    customerInfo,
    notes,
    subtotal,
    tax,
    total,
    isTaxEnabled: taxSettings.enabled,
    taxRate: taxSettings.rate,
    itemCount,
    setCustomerInfo,
    setNotes,
    addItem,
    updateQuantity,
    updateItemPrice,
    removeItem,
    clearCart,
  };
});
