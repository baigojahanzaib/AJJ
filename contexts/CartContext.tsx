import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { CartItem, Product, SelectedVariation } from '@/types';

export const [CartProvider, useCart] = createContextHook(() => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });
  const [notes, setNotes] = useState('');

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

  const clearCart = useCallback(() => {
    console.log('[Cart] Clearing cart');
    setItems([]);
    setCustomerInfo({ name: '', phone: '', email: '', address: '', latitude: undefined, longitude: undefined });
    setNotes('');
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [items]);

  const tax = useMemo(() => {
    return subtotal * 0.09;
  }, [subtotal]);

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
    itemCount,
    setCustomerInfo,
    setNotes,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };
});
