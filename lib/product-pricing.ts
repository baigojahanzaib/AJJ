import { Product, ProductCombination, SelectedVariation, VariationOption } from '@/types';

const normalizeText = (value: string | undefined) => (value ?? '').trim().toLowerCase();

export function formatPriceModifier(priceModifier: number): string {
  if (!Number.isFinite(priceModifier) || Math.abs(priceModifier) < 0.005) return '';

  const prefix = priceModifier > 0 ? '+' : '-';
  return `${prefix}R${Math.abs(priceModifier).toFixed(2)}`;
}

export function formatCurrency(price: number): string {
  return `R${(Number.isFinite(price) ? price : 0).toFixed(2)}`;
}

export function getVariationOptionFinalPrice(basePrice: number, option: Pick<VariationOption, 'priceModifier'>): number {
  return basePrice + (Number.isFinite(option.priceModifier) ? option.priceModifier : 0);
}

export function getPriceModifierFromFinalPrice(basePrice: number, finalPrice: number): number {
  const normalizedBasePrice = Number.isFinite(basePrice) ? basePrice : 0;
  const normalizedFinalPrice = Number.isFinite(finalPrice) ? finalPrice : normalizedBasePrice;
  return normalizedFinalPrice - normalizedBasePrice;
}

export const getSelectionKey = (selectedVariations: SelectedVariation[]) => (
  selectedVariations
    .map(variation => `${variation.variationId}:${variation.optionId}`)
    .sort()
    .join('|')
);

export function resolveSelectedVariations(
  product: Product,
  selectedVariations: SelectedVariation[]
): SelectedVariation[] {
  return product.variations
    .map(variation => {
      const previousSelection = selectedVariations.find(selection =>
        selection.variationId === variation.id ||
        normalizeText(selection.variationName) === normalizeText(variation.name)
      );
      const option = variation.options.find(item =>
        item.id === previousSelection?.optionId ||
        normalizeText(item.name) === normalizeText(previousSelection?.optionName)
      ) ?? variation.options[0];

      if (!option) return null;

      return {
        variationId: variation.id,
        variationName: variation.name,
        optionId: option.id,
        optionName: option.name,
        priceModifier: option.priceModifier,
      } satisfies SelectedVariation;
    })
    .filter((selection): selection is SelectedVariation => selection !== null);
}

export function getSelectedVariationsFromOptionIds(
  product: Product,
  selectedOptionIds: Record<string, string>
): SelectedVariation[] {
  return resolveSelectedVariations(
    product,
    product.variations
      .map(variation => {
        const option = variation.options.find(item => item.id === selectedOptionIds[variation.id]);
        if (!option) return null;

        return {
          variationId: variation.id,
          variationName: variation.name,
          optionId: option.id,
          optionName: option.name,
          priceModifier: option.priceModifier,
        } satisfies SelectedVariation;
      })
      .filter((selection): selection is SelectedVariation => selection !== null)
  );
}

export function getDefaultSelectedVariations(product: Product): SelectedVariation[] {
  return resolveSelectedVariations(product, []);
}

export function getSelectedVariationSummary(selectedVariations: SelectedVariation[]): string {
  return selectedVariations
    .map(variation => `${variation.variationName}: ${variation.optionName}`)
    .join(' / ');
}

export function findMatchingCombination(
  product: Product,
  selectedVariations: SelectedVariation[]
): ProductCombination | undefined {
  if (!product.combinations?.length) return undefined;

  return product.combinations.find(combination =>
    combination.options.every(comboOption =>
      selectedVariations.some(selected =>
        normalizeText(selected.variationName) === normalizeText(comboOption.name) &&
        normalizeText(selected.optionName) === normalizeText(comboOption.value)
      )
    )
  );
}

export function calculateProductUnitPrice(
  product: Product,
  selectedVariations: SelectedVariation[] = []
): number {
  const resolvedSelections = resolveSelectedVariations(product, selectedVariations);
  const matchingCombination = findMatchingCombination(product, resolvedSelections);

  if (matchingCombination && Number.isFinite(matchingCombination.price)) {
    return matchingCombination.price;
  }

  return product.basePrice + resolvedSelections.reduce((sum, selection) => (
    sum + selection.priceModifier
  ), 0);
}

export function getProductPriceRange(product: Product) {
  if (product.combinations?.length) {
    const prices = product.combinations
      .map(combination => combination.price)
      .filter(price => Number.isFinite(price) && price > 0);

    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return { min, max, hasRange: max > min };
    }
  }

  let min = product.basePrice;
  let max = product.basePrice;

  product.variations.forEach(variation => {
    if (variation.options.length === 0) return;

    const modifiers = variation.options.map(option => option.priceModifier);
    min += Math.min(...modifiers);
    max += Math.max(...modifiers);
  });

  return { min, max, hasRange: max > min };
}

export function getStartingPrice(product: Product): number {
  return getProductPriceRange(product).min;
}

export function getProductSkuForSelections(
  product: Product,
  selectedVariations: SelectedVariation[]
): string {
  const resolvedSelections = resolveSelectedVariations(product, selectedVariations);
  const matchingCombination = findMatchingCombination(product, resolvedSelections);

  if (matchingCombination?.sku) return matchingCombination.sku;

  const optionSku = resolvedSelections
    .map(selection => {
      const variation = product.variations.find(item => item.id === selection.variationId);
      return variation?.options.find(option => option.id === selection.optionId)?.sku;
    })
    .find(sku => !!sku?.trim());

  return optionSku || product.sku;
}

export function getEffectiveMoq(product: Product, selectedVariations: SelectedVariation[] = []): number {
  const resolvedSelections = resolveSelectedVariations(product, selectedVariations);
  let moq = product.moq || 1;

  resolvedSelections.forEach(selection => {
    const variation = product.variations.find(item => item.id === selection.variationId);
    const option = variation?.options.find(item => item.id === selection.optionId);
    if (option?.moq && option.moq > moq) {
      moq = option.moq;
    }
  });

  return Math.max(1, moq);
}

export function getProductVariationPreview(product: Product): string {
  return getDefaultSelectedVariations(product)
    .map(variation => {
      const optionPrice = product.basePrice + variation.priceModifier;
      return `${variation.variationName}: ${variation.optionName} ${formatCurrency(optionPrice)}`;
    })
    .join(' / ');
}
