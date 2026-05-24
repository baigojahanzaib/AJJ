import { CartItem, OrderItem, SelectedVariation } from '@/types';
import { getProductSkuForSelections } from '@/lib/product-pricing';

const allocateLineTotals = (total: number, parts: number) => {
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / parts);
  let remainingCents = totalCents;

  return Array.from({ length: parts }, (_, index) => {
    const cents = index === parts - 1 ? remainingCents : baseCents;
    remainingCents -= cents;
    return cents / 100;
  });
};

const buildOrderItem = (
  item: CartItem,
  selectedVariations: SelectedVariation[],
  totalPrice = item.totalPrice
): OrderItem => ({
  id: selectedVariations.length === item.selectedVariations.length
    ? item.id
    : `${item.id}-${selectedVariations[0]?.variationId ?? 'base'}-${selectedVariations[0]?.optionId ?? 'base'}`,
  productId: item.product.id,
  productName: item.product.name,
  productSku: getProductSkuForSelections(item.product, selectedVariations),
  productImage: item.product.images?.[0] ?? '',
  selectedVariations,
  quantity: item.quantity,
  unitPrice: item.quantity > 0 ? totalPrice / item.quantity : totalPrice,
  totalPrice,
});

export const buildOrderItemsFromCartItems = (items: CartItem[]): OrderItem[] => (
  items.flatMap((item) => {
    if (item.selectedVariations.length <= 1) {
      return [buildOrderItem(item, item.selectedVariations)];
    }

    const lineTotals = allocateLineTotals(item.totalPrice, item.selectedVariations.length);
    return item.selectedVariations.map((variation, index) => (
      buildOrderItem(item, [variation], lineTotals[index])
    ));
  })
);
