import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { CartItem, Product, SelectedVariation } from '@/types';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import { useAuth } from '@/contexts/AuthContext';

const CART_STORAGE_KEY_PREFIX = '@salesapp_cart_draft';

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
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState(createEmptyCustomerInfo);
  const [notes, setNotes] = useState('');
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

  const cartStorageKey = user?.id ? `${CART_STORAGE_KEY_PREFIX}:${user.id}` : null;

  useEffect(() => {
    let isMounted = true;

    const loadCartDraft = async () => {
      setHasHydratedDraft(false);
      setHydratedStorageKey(null);

      if (isAuthLoading) return;

      if (!isAuthenticated || !cartStorageKey) {
        setItems([]);
        setCustomerInfo(createEmptyCustomerInfo());
        setNotes('');
        setHasHydratedDraft(true);
        return;
      }

      try {
        const rawDraft = await AsyncStorage.getItem(cartStorageKey);
        if (!isMounted) return;

        if (!rawDraft) {
          setItems([]);
          setCustomerInfo(createEmptyCustomerInfo());
          setNotes('');
          return;
        }

        const parsed = JSON.parse(rawDraft) as Partial<CartDraft>;
        setItems(Array.isArray(parsed.items) ? parsed.items : []);
        setCustomerInfo({
          ...createEmptyCustomerInfo(),
          ...(parsed.customerInfo ?? {}),
        });
        setNotes(typeof parsed.notes === 'string' ? parsed.notes : '');
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
    if (!hasHydratedDraft || !cartStorageKey || hydratedStorageKey !== cartStorageKey) return;

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

  const calculateItemPrice = (product: Product, selectedVariations: SelectedVariation[]): number => {
    // Check for matching combination first
    if (product.combinations && product.combinations.length > 0) {
      const match = product.combinations.find(combo => {
        // Every option in the combination must match a selected variation
        return combo.options.every(comboOption => {
          const comboOptName = comboOption.name.trim().toLowerCase();
          const comboOptValue = comboOption.value.trim().toLowerCase();

          const isMatch = selectedVariations.some(selected =>
            selected.variationName.trim().toLowerCase() === comboOptName &&
            selected.optionName.trim().toLowerCase() === comboOptValue
          );

          if (!isMatch) {
            // console.log(`[Cart] No match for combo option: ${comboOptName}=${comboOptValue}`);
          }
          return isMatch;
        });
      });

      if (match) {
        return match.price;
      }
    }

    // Fallback to modifiers
    let price = product.basePrice;
    for (const variation of selectedVariations) {
      price += variation.priceModifier;
    }
    return price;
  };

  const addItem = useCallback((product: Product, selectedVariations: SelectedVariation[], quantity: number = 1) => {
    console.log('[Cart] Adding item:', product.name, 'quantity:', quantity);

    setItems(prev => {
      const variationKey = selectedVariations.map(v => `${v.variationId}:${v.optionId}`).sort().join('|');
      const existingIndex = prev.findIndex(item =>
        item.product.id === product.id &&
        item.selectedVariations.map(v => `${v.variationId}:${v.optionId}`).sort().join('|') === variationKey
      );

      const unitPrice = calculateItemPrice(product, selectedVariations);

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
          totalPrice: unitPrice * newQuantity,
        };
        return updated;
      }

      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        product,
        selectedVariations,
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
