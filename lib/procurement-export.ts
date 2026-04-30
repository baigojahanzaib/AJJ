import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Order, OrderItem, Product, ProductCombination, SelectedVariation, VariationOption } from '@/types';

export type ProcurementExportMode = 'all' | 'missing';

export interface ProcurementExportRow {
  productName: string;
  sku: string;
  variation: string;
  orderedQuantity: number;
  currentStock: number;
  quantityToBuy: number;
  orderNumbers: string[];
  customers: string[];
}

interface DraftProcurementRow {
  productName: string;
  sku: string;
  variation: string;
  orderedQuantity: number;
  currentStock: number;
  orderNumbers: Set<string>;
  customers: Set<string>;
}

const normalizeOptionText = (value: string | undefined) => value?.trim().toLowerCase() ?? '';

const getVariationLabel = (selectedVariations: SelectedVariation[]) => {
  if (selectedVariations.length === 0) return 'Base product';

  return selectedVariations
    .map((variation) => {
      const variationName = variation.variationName.trim();
      const optionName = variation.optionName.trim();
      return variationName ? `${variationName}: ${optionName}` : optionName;
    })
    .filter(Boolean)
    .join(' / ') || 'Base product';
};

const selectedVariationsMatchCombination = (
  combination: ProductCombination,
  selectedVariations: SelectedVariation[]
) => {
  if (combination.options.length !== selectedVariations.length) return false;

  return combination.options.every((combinationOption) => (
    selectedVariations.some((selectedVariation) => (
      normalizeOptionText(selectedVariation.variationName) === normalizeOptionText(combinationOption.name) &&
      normalizeOptionText(selectedVariation.optionName) === normalizeOptionText(combinationOption.value)
    ))
  ));
};

const findSelectedVariationOption = (
  product: Product,
  selectedVariation: SelectedVariation
): VariationOption | undefined => {
  const variation = product.variations.find((candidateVariation) => (
    candidateVariation.id === selectedVariation.variationId ||
    normalizeOptionText(candidateVariation.name) === normalizeOptionText(selectedVariation.variationName)
  ));

  return variation?.options.find((option) => (
    option.id === selectedVariation.optionId ||
    normalizeOptionText(option.name) === normalizeOptionText(selectedVariation.optionName)
  ));
};

const resolveOrderItemStock = (item: OrderItem, productsById: Map<string, Product>) => {
  const product = productsById.get(item.productId);
  const selectedVariations = item.selectedVariations ?? [];
  const fallback = {
    productName: item.productName,
    sku: item.productSku,
    currentStock: 0,
  };

  if (!product) return fallback;

  const matchingCombination = product.combinations?.find((combination) => (
    selectedVariationsMatchCombination(combination, selectedVariations)
  ));

  if (matchingCombination) {
    return {
      productName: product.name,
      sku: matchingCombination.sku?.trim() || item.productSku || product.sku,
      currentStock: matchingCombination.stock ?? product.stock,
    };
  }

  if (selectedVariations.length === 1) {
    const selectedOption = findSelectedVariationOption(product, selectedVariations[0]);

    if (selectedOption) {
      return {
        productName: product.name,
        sku: selectedOption.sku?.trim() || item.productSku || product.sku,
        currentStock: selectedOption.stock,
      };
    }
  }

  return {
    productName: product.name,
    sku: item.productSku || product.sku,
    currentStock: product.stock,
  };
};

export function buildProcurementExportRows(
  orders: Order[],
  products: Product[],
  mode: ProcurementExportMode
): ProcurementExportRow[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const rowsByKey = new Map<string, DraftProcurementRow>();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const stockDetails = resolveOrderItemStock(item, productsById);
      const variation = getVariationLabel(item.selectedVariations ?? []);
      const sku = stockDetails.sku.trim() || item.productSku || 'UNKNOWN-SKU';
      const key = `${sku.toLowerCase()}|${variation.toLowerCase()}`;
      const existing = rowsByKey.get(key);

      if (existing) {
        existing.orderedQuantity += item.quantity;
        existing.orderNumbers.add(order.orderNumber);
        existing.customers.add(order.customerName);
        return;
      }

      rowsByKey.set(key, {
        productName: stockDetails.productName,
        sku,
        variation,
        orderedQuantity: item.quantity,
        currentStock: stockDetails.currentStock,
        orderNumbers: new Set([order.orderNumber]),
        customers: new Set([order.customerName]),
      });
    });
  });

  return Array.from(rowsByKey.values())
    .map((row) => ({
      productName: row.productName,
      sku: row.sku,
      variation: row.variation,
      orderedQuantity: row.orderedQuantity,
      currentStock: row.currentStock,
      quantityToBuy: Math.max(row.orderedQuantity - row.currentStock, 0),
      orderNumbers: Array.from(row.orderNumbers),
      customers: Array.from(row.customers),
    }))
    .filter((row) => mode === 'all' || row.quantityToBuy > 0)
    .sort((left, right) => left.productName.localeCompare(right.productName) || left.sku.localeCompare(right.sku));
}

const escapeCsvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

export function generateProcurementCsv(rows: ProcurementExportRow[]): string {
  const headers = [
    'Product Name',
    'SKU',
    'Variation',
    'Ordered Quantity',
    'Current Stock',
    'Quantity To Buy',
    'Order Numbers',
    'Customers',
  ];

  const body = rows.map((row) => [
    row.productName,
    row.sku,
    row.variation,
    row.orderedQuantity,
    row.currentStock,
    row.quantityToBuy,
    row.orderNumbers.join('; '),
    row.customers.join('; '),
  ]);

  return [headers, ...body].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export async function generateAndShareProcurementCsv(
  orders: Order[],
  products: Product[],
  mode: ProcurementExportMode
) {
  const rows = buildProcurementExportRows(orders, products, mode);
  const fileNamePrefix = mode === 'missing' ? 'missing_stock' : 'order_products';
  const fileName = `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;

  if (rows.length === 0) {
    return {
      fileName,
      fileUri: '',
      rowCount: 0,
    };
  }

  const csvContent = generateProcurementCsv(rows);
  const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  if (!docDir) {
    throw new Error('No writable document directory is available.');
  }

  const fileUri = `${docDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: mode === 'missing' ? 'Export Missing Stock' : 'Export Order Products',
      UTI: 'public.comma-separated-values-text',
    });
  }

  return {
    fileName,
    fileUri,
    rowCount: rows.length,
  };
}
