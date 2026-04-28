import type { Category, Product, ProductVariation, VariationOption } from '@/types';

export type ProductCsvImportProduct = Omit<Product, 'id' | 'createdAt' | 'categoryId'> & {
  id?: string;
  createdAt?: string;
  categoryId?: string;
  categoryName?: string;
};

export interface ProductCsvParseResult {
  products: ProductCsvImportProduct[];
  warnings: string[];
  errors: string[];
}

export interface ProductCsvRoundTripValidation {
  isValid: boolean;
  csvContent: string;
  parsedProducts: ProductCsvImportProduct[];
  warnings: string[];
  errors: string[];
}

const PRODUCT_CSV_FORMAT = 'ajj-products-v4';

const PRODUCT_ECWID_BASE_CSV_HEADERS = [
  'type',
  'format_version',
  'product_id',
  'ecwid_id',
  'product_internal_id',
  'product_sku',
  'product_name',
  'product_description',
  'category_id',
  'product_category_1',
  'product_price',
  'product_compare_to_price',
  'product_is_inventory_tracked',
  'product_quantity',
  'product_quantity_minimum_allowed_for_purchase',
  'product_is_available',
  'product_media_main_image_url',
  'product_attribute_MOQ',
  'product_ribbon_text',
  'product_ribbon_color',
  'product_option_name',
  'product_option_type',
  'product_option_is_required',
  'product_option_value',
  'product_option_markup',
  'product_option_sku',
  'product_option_stock',
  'product_option_moq',
  'product_option_image',
  'product_variation_id',
  'product_variation_sku',
  'product_variation_name',
  'ajj_row_kind',
  'variations_json',
  'combinations_json',
];

type CsvDataRow = {
  rowNumber: number;
  values: string[];
};

type EcwidGroup = {
  key: string;
  productRow?: CsvDataRow;
  optionRows: CsvDataRow[];
  variationRows: CsvDataRow[];
  rows: CsvDataRow[];
};

type CsvProductCombination = NonNullable<Product['combinations']>[number];

type DraftOption = {
  name: string;
  priceModifier?: number;
  sku?: string;
  stock?: number;
  image?: string;
  moq?: number;
};

type DraftVariation = {
  name: string;
  options: Map<string, DraftOption>;
};

export function generateProductCsv(products: Product[], categories: Category[]): string {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const maxGalleryImageCount = Math.max(0, ...products.map((product) => Math.max(0, product.images.length - 1)));
  const galleryHeaders = buildGalleryImageHeaders(maxGalleryImageCount);
  const variationOptionHeaders = buildEcwidVariationOptionHeaders(products);
  const headers = [
    ...PRODUCT_ECWID_BASE_CSV_HEADERS,
    ...galleryHeaders,
    ...variationOptionHeaders.map((header) => header.header),
  ];
  const rows = [headers];

  products.forEach((product) => {
    rows.push(...buildEcwidProductRows(product, categoryById.get(product.categoryId), headers, variationOptionHeaders));
  });

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function validateProductCsvRoundTrip(products: Product[], categories: Category[]): ProductCsvRoundTripValidation {
  const csvContent = generateProductCsv(products, categories);
  const parsed = parseProductCsv(csvContent);
  const errors = [...parsed.errors];
  const parsedById = new Map<string, ProductCsvImportProduct>();
  parsed.products.forEach((product) => {
    if (product.id) parsedById.set(product.id, product);
  });
  const parsedBySku = groupProductsBySku(parsed.products);

  if (parsed.products.length !== products.length) {
    errors.push(`Expected ${products.length} products after round-trip, got ${parsed.products.length}.`);
  }

  products.forEach((product, index) => {
    const parsedProduct = findRoundTripProduct(product, parsed.products, parsedById, parsedBySku, index);
    if (!parsedProduct) {
      errors.push(`Product ${product.sku} was not found after CSV round-trip.`);
      return;
    }

    errors.push(...compareRoundTripProduct(product, parsedProduct));
  });

  return {
    isValid: errors.length === 0,
    csvContent,
    parsedProducts: parsed.products,
    warnings: parsed.warnings,
    errors,
  };
}

function groupProductsBySku(products: ProductCsvImportProduct[]): Map<string, ProductCsvImportProduct[]> {
  const productsBySku = new Map<string, ProductCsvImportProduct[]>();

  products.forEach((product) => {
    const productsForSku = productsBySku.get(product.sku) ?? [];
    productsForSku.push(product);
    productsBySku.set(product.sku, productsForSku);
  });

  return productsBySku;
}

function findRoundTripProduct(
  product: Product,
  parsedProducts: ProductCsvImportProduct[],
  parsedById: Map<string, ProductCsvImportProduct>,
  parsedBySku: Map<string, ProductCsvImportProduct[]>,
  index: number
): ProductCsvImportProduct | undefined {
  const parsedByProductId = parsedById.get(product.id);
  if (parsedByProductId) return parsedByProductId;

  const sameSkuProducts = parsedBySku.get(product.sku) ?? [];
  if (sameSkuProducts.length === 1) return sameSkuProducts[0];

  const parsedAtSameIndex = parsedProducts[index];
  if (parsedAtSameIndex?.sku === product.sku) return parsedAtSameIndex;

  return sameSkuProducts[0];
}

export function parseProductCsv(content: string): ProductCsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rows = parseCsv(content).filter((row) => row.some((cellValue) => cellValue.trim() !== ''));

  if (rows.length === 0) {
    return { products: [], warnings, errors: ['CSV file is empty.'] };
  }

  const headers = rows[0].map((header, index) => (index === 0 ? stripBom(header) : header).trim());
  if (headers.length === 0 || headers.every((header) => header === '')) {
    return { products: [], warnings, errors: ['CSV file has no header row.'] };
  }

  const dataRows = rows.slice(1).map((values, index) => ({ rowNumber: index + 2, values }));
  const hasEcwidTypeColumn = getHeaderIndex(headers, 'type') >= 0;
  const hasEcwidRows = hasEcwidTypeColumn && dataRows.some((row) => {
    const rowType = getCell(headers, row.values, 'type').toLowerCase();
    return rowType === 'product' || rowType === 'product_option' || rowType === 'product_variation';
  });

  if (hasEcwidRows) {
    return parseEcwidProductCsv(headers, dataRows);
  }

  const products = dataRows
    .map((row) => parseAppProductRow(headers, row, warnings, errors))
    .filter((product): product is ProductCsvImportProduct => product !== null);

  return { products, warnings, errors };
}

function parseAppProductRow(
  headers: string[],
  row: CsvDataRow,
  warnings: string[],
  errors: string[]
): ProductCsvImportProduct | null {
  const name = firstCell(headers, row.values, ['name', 'product_name'])?.trim();
  const sku = firstCell(headers, row.values, ['sku', 'product_sku'])?.trim();

  if (!name && !sku) return null;
  if (!name || !sku) {
    errors.push(`Row ${row.rowNumber}: product name and SKU are required.`);
    return null;
  }

  const basePrice = parseRequiredNumber(
    firstCell(headers, row.values, ['base_price', 'price', 'product_price']),
    `Row ${row.rowNumber}: base price`,
    errors
  );
  if (basePrice === null) return null;

  const variations = parseJsonArray<ProductVariation>(
    firstCell(headers, row.values, ['variations_json', 'variations']),
    `Row ${row.rowNumber}: variations_json`,
    warnings
  );
  const combinations = parseJsonArray<CsvProductCombination>(
    firstCell(headers, row.values, ['combinations_json', 'combinations']),
    `Row ${row.rowNumber}: combinations_json`,
    warnings
  );
  const parsedVariations = variations.length > 0
    ? normalizeVariations(variations, sku)
    : parseReadableVariationColumns(headers, row.values, sku);
  const parsedCombinations = combinations.length > 0
    ? normalizeCombinations(combinations, basePrice)
    : parseIndexedCombinationColumns(headers, row.values, basePrice) ??
      parseLegacyCombinationColumns(headers, row.values, basePrice);

  const images = parseImagesFromAppRow(headers, row.values);

  return {
    id: firstCell(headers, row.values, ['product_id', 'id'])?.trim() || undefined,
    ecwidId: parseOptionalIdentifierNumber(firstCell(headers, row.values, ['ecwid_id', 'product_internal_id'])),
    sku,
    name,
    description: firstCell(headers, row.values, ['description', 'product_description'])?.trim() ?? '',
    basePrice,
    compareAtPrice: parseOptionalNumber(firstCell(headers, row.values, ['compare_at_price', 'product_compare_to_price'])),
    stock: parseOptionalNumber(firstCell(headers, row.values, ['stock', 'product_quantity'])) ?? 0,
    moq: parseOptionalNumber(firstCell(headers, row.values, ['moq', 'product_attribute_MOQ'])),
    categoryId: firstCell(headers, row.values, ['category_id'])?.trim() || undefined,
    categoryName: firstCell(headers, row.values, ['category_name', 'product_category_1', 'category_path'])?.trim() || undefined,
    isActive: parseBoolean(firstCell(headers, row.values, ['is_active', 'product_is_available']), true),
    images,
    variations: parsedVariations,
    combinations: parsedCombinations,
    ribbon: firstCell(headers, row.values, ['ribbon', 'product_ribbon_text'])?.trim() || undefined,
    ribbonColor: firstCell(headers, row.values, ['ribbon_color', 'product_ribbon_color'])?.trim() || undefined,
  };
}

function parseEcwidProductCsv(headers: string[], dataRows: CsvDataRow[]): ProductCsvParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const groups = new Map<string, EcwidGroup>();
  let currentProductKey = '';

  for (const row of dataRows) {
    const rowType = getCell(headers, row.values, 'type').toLowerCase();
    const explicitKey =
      getCell(headers, row.values, 'product_id') ||
      getCell(headers, row.values, 'product_internal_id') ||
      getCell(headers, row.values, 'ecwid_id') ||
      getCell(headers, row.values, 'product_sku');
    const key = explicitKey || currentProductKey || `row-${row.rowNumber}`;

    if (rowType === 'product') currentProductKey = key;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        optionRows: [],
        variationRows: [],
        rows: [],
      });
    }

    const group = groups.get(key)!;
    group.rows.push(row);

    if (rowType === 'product') {
      group.productRow = row;
    } else if (rowType === 'product_option') {
      group.optionRows.push(row);
    } else if (rowType === 'product_variation') {
      group.variationRows.push(row);
    }
  }

  const products = Array.from(groups.values())
    .map((group) => parseEcwidProductGroup(headers, group, warnings, errors))
    .filter((product): product is ProductCsvImportProduct => product !== null);

  return { products, warnings, errors };
}

function parseEcwidProductGroup(
  headers: string[],
  group: EcwidGroup,
  warnings: string[],
  errors: string[]
): ProductCsvImportProduct | null {
  const productRow = group.productRow ?? group.rows.find((row) => getCell(headers, row.values, 'product_name'));
  if (!productRow) {
    warnings.push(`Skipped CSV group ${group.key}: no product row found.`);
    return null;
  }

  const row = productRow.values;
  const appFormatVersion = getCell(headers, row, 'format_version').trim();
  const isAppFormattedExport = appFormatVersion.startsWith('ajj-products-');
  const productId = getCell(headers, row, 'product_id').trim();
  const name = getCell(headers, row, 'product_name').trim();
  const sku = getCell(headers, row, 'product_sku').trim() || `ECWID-${productId || getCell(headers, row, 'product_internal_id') || productRow.rowNumber}`;

  if (!name) {
    errors.push(`Row ${productRow.rowNumber}: product_name is required.`);
    return null;
  }

  const basePrice = parseRequiredNumber(getCell(headers, row, 'product_price'), `Row ${productRow.rowNumber}: product_price`, errors);
  if (basePrice === null) return null;

  const stock = parseOptionalNumber(getCell(headers, row, 'product_quantity')) ?? 0;
  const images = collectEcwidProductImages(headers, row);
  const rowVariations = buildEcwidVariations(headers, group, sku, basePrice, stock);
  const rowCombinations = buildEcwidCombinations(headers, group, basePrice);
  const exportedVariations = isAppFormattedExport
    ? parseJsonArray<ProductVariation>(
      getCell(headers, row, 'variations_json'),
      `Row ${productRow.rowNumber}: variations_json`,
      warnings
    )
    : [];
  const exportedCombinations = isAppFormattedExport
    ? parseJsonArray<CsvProductCombination>(
      getCell(headers, row, 'combinations_json'),
      `Row ${productRow.rowNumber}: combinations_json`,
      warnings
    )
    : [];
  const variations = exportedVariations.length > 0
    ? mergeExportedVariationsWithVariationRows(
      normalizeVariations(exportedVariations, sku),
      headers,
      group,
      basePrice
    )
    : rowVariations;
  const normalizedExportedCombinations = normalizeCombinations(exportedCombinations, basePrice);
  const combinations = normalizedExportedCombinations
    ? mergeExportedCombinationsWithVariationRows(normalizedExportedCombinations, rowCombinations)
    : rowCombinations;
  const fallbackImages = collectEcwidVariationImages(headers, group);

  return {
    id: productId || undefined,
    ecwidId: parseOptionalIdentifierNumber(firstCell(headers, row, ['ecwid_id', 'product_internal_id'])),
    sku,
    name,
    description: isAppFormattedExport
      ? getCell(headers, row, 'product_description').trim()
      : stripHtml(getCell(headers, row, 'product_description')),
    basePrice,
    compareAtPrice: parseOptionalNumber(getCell(headers, row, 'product_compare_to_price')),
    images: images.length > 0 ? images : (fallbackImages.length > 0 ? fallbackImages : ['https://via.placeholder.com/300']),
    categoryId: getCell(headers, row, 'category_id').trim() || undefined,
    categoryName: firstCell(headers, row, ['product_category_1', 'category_path'])?.trim() || undefined,
    isActive: parseBoolean(getCell(headers, row, 'product_is_available'), true),
    variations,
    combinations,
    stock,
    moq: parseOptionalNumber(getCell(headers, row, 'product_attribute_MOQ')) ??
      parseOptionalNumber(getCell(headers, row, 'product_quantity_minimum_allowed_for_purchase')),
    ribbon: getCell(headers, row, 'product_ribbon_text').trim() || undefined,
    ribbonColor: getCell(headers, row, 'product_ribbon_color').trim() || undefined,
  };
}

function buildEcwidVariations(
  headers: string[],
  group: EcwidGroup,
  baseSku: string,
  basePrice: number,
  baseStock: number
): ProductVariation[] {
  const draftVariations = new Map<string, DraftVariation>();
  const optionImages = new Map<string, Set<string>>();

  const getDraftVariation = (name: string): DraftVariation => {
    const normalizedName = name.trim();
    const key = normalizedName;
    if (!draftVariations.has(key)) {
      draftVariations.set(key, {
        name: normalizedName,
        options: new Map(),
      });
    }
    return draftVariations.get(key)!;
  };

  const addOption = (variationName: string, optionName: string, updates: Partial<DraftOption> = {}) => {
    const draftVariation = getDraftVariation(variationName);
    const normalizedOptionName = optionName.trim();
    const optionKey = normalizedOptionName;
    const existing = draftVariation.options.get(optionKey);
    draftVariation.options.set(optionKey, {
      name: normalizedOptionName,
      ...existing,
      ...definedOnly(updates),
    });
  };

  for (const optionRow of group.optionRows) {
    const variationName = getCell(headers, optionRow.values, 'product_option_name').trim();
    const optionName = getCell(headers, optionRow.values, 'product_option_value').trim();
    if (!variationName || !optionName) continue;

    addOption(variationName, optionName, {
      priceModifier: parseOptionalNumber(getCell(headers, optionRow.values, 'product_option_markup')) ?? 0,
      sku: getCell(headers, optionRow.values, 'product_option_sku').trim() || undefined,
      stock: parseOptionalNumber(getCell(headers, optionRow.values, 'product_option_stock')) ?? baseStock,
      image: getCell(headers, optionRow.values, 'product_option_image').trim() || undefined,
      moq: parseOptionalNumber(getCell(headers, optionRow.values, 'product_option_moq')),
    });
  }

  const variationColumns = getEcwidVariationColumns(headers);
  group.variationRows.forEach((variationRow) => {
    const rowKind = getCell(headers, variationRow.values, 'ajj_row_kind').trim();
    const selectedOptions = variationColumns
      .map((column) => ({
        variationName: column.name,
        optionName: variationRow.values[column.index]?.trim() ?? '',
      }))
      .filter((option) => option.optionName !== '');

    if (selectedOptions.length === 0) return;

    const variationSku = getCell(headers, variationRow.values, 'product_variation_sku').trim();
    const variationStock = parseOptionalNumber(getCell(headers, variationRow.values, 'product_quantity'));
    const variationPrice = parseOptionalNumber(getCell(headers, variationRow.values, 'product_price'));
    const variationImage = getCell(headers, variationRow.values, 'product_media_main_image_url').trim();
    const applyVariationDetailsToOptions = rowKind !== 'combination_variation';

    selectedOptions.forEach((selectedOption) => {
      if (applyVariationDetailsToOptions) {
        addOption(selectedOption.variationName, selectedOption.optionName, {
          stock: variationStock ?? baseStock,
        });
      }

      if (variationImage) {
        const key = `${selectedOption.variationName}:${selectedOption.optionName}`;
        if (!optionImages.has(key)) optionImages.set(key, new Set());
        optionImages.get(key)!.add(variationImage);
      }
    });

    if (selectedOptions.length === 1 && applyVariationDetailsToOptions) {
      const selectedOption = selectedOptions[0];
      addOption(selectedOption.variationName, selectedOption.optionName, {
        sku: variationSku || undefined,
        stock: variationStock ?? baseStock,
        image: variationImage || undefined,
        priceModifier: variationPrice !== undefined ? variationPrice - basePrice : undefined,
      });
    }
  });

  for (const draftVariation of draftVariations.values()) {
    for (const option of draftVariation.options.values()) {
      const imageKey = `${draftVariation.name}:${option.name}`;
      const images = optionImages.get(imageKey);
      if (!option.image && images?.size === 1) {
        option.image = Array.from(images)[0];
      }
    }
  }

  return Array.from(draftVariations.values()).map((variation, variationIndex) => ({
    id: `var-${slugify(variation.name) || variationIndex}`,
    name: variation.name,
    options: Array.from(variation.options.values()).map((option, optionIndex) => ({
      id: `opt-${slugify(variation.name) || variationIndex}-${slugify(option.name) || optionIndex}`,
      name: option.name,
      priceModifier: option.priceModifier ?? 0,
      sku: option.sku ?? '',
      stock: option.stock ?? baseStock,
      image: option.image,
      moq: option.moq,
    })),
  }));
}

function buildEcwidCombinations(
  headers: string[],
  group: EcwidGroup,
  basePrice: number
): Product['combinations'] {
  const variationColumns = getEcwidVariationColumns(headers);
  const combinations = group.variationRows
    .map((variationRow): CsvProductCombination | null => {
      if (getCell(headers, variationRow.values, 'ajj_row_kind').trim() === 'option_variation') {
        return null;
      }

      const options = variationColumns
        .map((column) => ({
          name: column.name,
          value: variationRow.values[column.index]?.trim() ?? '',
        }))
        .filter((option) => option.value !== '');

      if (options.length === 0) return null;

      const combination: CsvProductCombination = {
        id: getCell(headers, variationRow.values, 'product_variation_id') ||
          (getCell(headers, variationRow.values, 'product_internal_id') ?
          `${getCell(headers, variationRow.values, 'product_internal_id')}-${variationRow.rowNumber}` :
          `csv-${variationRow.rowNumber}`),
        options,
        price: parseOptionalNumber(getCell(headers, variationRow.values, 'product_price')) ?? basePrice,
      };

      const sku = getCell(headers, variationRow.values, 'product_variation_sku').trim();
      const stock = parseOptionalNumber(getCell(headers, variationRow.values, 'product_quantity'));
      if (sku) combination.sku = sku;
      if (stock !== undefined) combination.stock = stock;

      return combination;
    })
    .filter((combination): combination is CsvProductCombination => combination !== null);

  return combinations.length > 0 ? combinations : undefined;
}

function mergeExportedVariationsWithVariationRows(
  variations: ProductVariation[],
  headers: string[],
  group: EcwidGroup,
  basePrice: number
): ProductVariation[] {
  const merged = variations.map((variation) => ({
    ...variation,
    options: variation.options.map((option) => ({ ...option })),
  }));
  const optionsById = new Map<string, VariationOption>();

  merged.forEach((variation) => {
    variation.options.forEach((option) => {
      if (option.id) optionsById.set(option.id, option);
    });
  });

  group.variationRows.forEach((variationRow) => {
    if (getCell(headers, variationRow.values, 'ajj_row_kind').trim() === 'combination_variation') return;

    const optionId = getCell(headers, variationRow.values, 'product_variation_id').trim();
    if (!optionId) return;

    const option = optionsById.get(optionId);
    if (!option) return;

    const sku = getCell(headers, variationRow.values, 'product_variation_sku').trim();
    const stock = parseOptionalNumber(getCell(headers, variationRow.values, 'product_quantity'));
    const moq = parseOptionalNumber(getCell(headers, variationRow.values, 'product_quantity_minimum_allowed_for_purchase'));
    const image = getCell(headers, variationRow.values, 'product_media_main_image_url').trim();
    const price = parseOptionalNumber(getCell(headers, variationRow.values, 'product_price'));

    if (sku) option.sku = sku;
    if (stock !== undefined) option.stock = stock;
    if (moq !== undefined) option.moq = moq;
    if (image) option.image = image;
    if (price !== undefined) option.priceModifier = price - basePrice;
  });

  return merged;
}

function mergeExportedCombinationsWithVariationRows(
  combinations: CsvProductCombination[],
  rowCombinations: Product['combinations']
): Product['combinations'] {
  if (!rowCombinations || rowCombinations.length === 0) return combinations;

  const rowsById = new Map(rowCombinations.map((combination) => [normalizeComparableValue(combination.id), combination]));
  const rowsBySku = new Map(
    rowCombinations
      .filter((combination) => combination.sku?.trim())
      .map((combination) => [combination.sku!.trim(), combination])
  );

  return combinations.map((combination, index) => {
    const rowCombination = rowsById.get(normalizeComparableValue(combination.id)) ??
      (combination.sku ? rowsBySku.get(combination.sku.trim()) : undefined) ??
      rowCombinations[index];

    if (!rowCombination) return combination;

    return {
      ...combination,
      price: rowCombination.price,
      sku: rowCombination.sku ?? combination.sku,
      stock: rowCombination.stock ?? combination.stock,
    };
  });
}

function collectEcwidProductImages(headers: string[], row: string[]): string[] {
  const images = new Set<string>();
  const mainImage = getCell(headers, row, 'product_media_main_image_url').trim();
  if (mainImage) images.add(mainImage);

  headers.forEach((header, index) => {
    if (/^product_media_gallery_image_url(?:_\d+)?$/i.test(header)) {
      const image = row[index]?.trim();
      if (image) images.add(image);
    }
  });

  return Array.from(images);
}

function collectEcwidVariationImages(headers: string[], group: EcwidGroup): string[] {
  const images = new Set<string>();
  group.variationRows.forEach((row) => {
    const image = getCell(headers, row.values, 'product_media_main_image_url').trim();
    if (image) images.add(image);
  });
  return Array.from(images);
}

function parseImagesFromAppRow(headers: string[], row: string[]): string[] {
  const imagesFromJson = parseJsonArray<string>(
    firstCell(headers, row, ['images_json']),
    'images_json',
    []
  ).filter((image) => typeof image === 'string' && image.trim() !== '');
  if (imagesFromJson.length > 0) return uniqueStrings(imagesFromJson);

  const primaryImage = firstCell(headers, row, ['primary_image', 'image', 'product_media_main_image_url'])?.trim();
  const listImages = splitList(firstCell(headers, row, ['images', 'image_urls']) ?? '');
  const images = uniqueStrings([primaryImage, ...listImages].filter((image): image is string => !!image));

  return images.length > 0 ? images : ['https://via.placeholder.com/300'];
}

type EcwidVariationOptionHeader = {
  variationName: string;
  header: string;
};

function buildGalleryImageHeaders(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `product_media_gallery_image_url_${index + 1}`);
}

function buildEcwidVariationOptionHeaders(products: Product[]): EcwidVariationOptionHeader[] {
  const variationNames = new Set<string>();

  products.forEach((product) => {
    product.variations.forEach((variation) => {
      const name = variation.name.trim();
      if (!name) return;
      variationNames.add(name);
    });

    product.combinations?.forEach((combination) => {
      combination.options.forEach((option) => {
        const name = option.name.trim();
        if (!name) return;
        variationNames.add(name);
      });
    });
  });

  return Array.from(variationNames).map((variationName) => ({
    variationName,
    header: `product_variation_option_${formatEcwidOptionHeaderSuffix(variationName)}`,
  }));
}

function formatEcwidOptionHeaderSuffix(value: string): string {
  return /^[A-Za-z0-9_]+$/.test(value) ? value : `{${value.replace(/[{}]/g, '').trim()}}`;
}

function buildEcwidProductRows(
  product: Product,
  category: Category | undefined,
  headers: string[],
  variationOptionHeaders: EcwidVariationOptionHeader[]
): string[][] {
  const productRows: Record<string, string>[] = [];
  const productInternalId = getProductInternalId(product);
  const sharedProductValues = {
    format_version: PRODUCT_CSV_FORMAT,
    product_id: product.id,
    ecwid_id: product.ecwidId?.toString() ?? '',
    product_internal_id: productInternalId,
    product_sku: product.sku,
  };

  productRows.push({
    ...sharedProductValues,
    type: 'product',
    product_name: product.name,
    product_description: product.description,
    category_id: product.categoryId,
    product_category_1: category?.name ?? '',
    product_price: product.basePrice.toString(),
    product_compare_to_price: product.compareAtPrice?.toString() ?? '',
    product_is_inventory_tracked: 'false',
    product_quantity: product.stock.toString(),
    product_quantity_minimum_allowed_for_purchase: product.moq?.toString() ?? '',
    product_is_available: product.isActive ? 'true' : 'false',
    product_media_main_image_url: product.images[0] ?? '',
    product_attribute_MOQ: product.moq?.toString() ?? '',
    product_ribbon_text: product.ribbon ?? '',
    product_ribbon_color: product.ribbonColor ?? '',
    variations_json: JSON.stringify(product.variations),
    combinations_json: JSON.stringify(product.combinations ?? []),
    ...Object.fromEntries(product.images.slice(1).map((image, index) => [
      `product_media_gallery_image_url_${index + 1}`,
      image,
    ])),
  });

  product.variations.forEach((variation) => {
    variation.options.forEach((option) => {
      productRows.push({
        ...sharedProductValues,
        type: 'product_option',
        product_option_name: variation.name,
        product_option_type: option.image ? 'RADIO' : 'SELECT',
        product_option_is_required: 'true',
        product_option_value: option.name,
        product_option_markup: option.priceModifier.toString(),
        product_option_sku: option.sku,
        product_option_stock: option.stock.toString(),
        product_option_moq: option.moq?.toString() ?? '',
        product_option_image: option.image ?? '',
      });
    });
  });

  const combinations = product.combinations ?? [];
  if (combinations.length > 0) {
    combinations.forEach((combination) => {
      productRows.push({
        ...sharedProductValues,
        type: 'product_variation',
        product_price: combination.price.toString(),
        product_quantity: combination.stock?.toString() ?? '',
        product_variation_id: combination.id?.toString() ?? '',
        product_variation_sku: combination.sku ?? '',
        product_variation_name: formatVariationSelectionLabel(combination.options),
        ajj_row_kind: 'combination_variation',
        ...formatVariationSelectionColumns(combination.options, variationOptionHeaders),
      });
    });
  } else {
    product.variations.forEach((variation) => {
      variation.options.forEach((option) => {
        productRows.push({
          ...sharedProductValues,
          type: 'product_variation',
          product_price: (product.basePrice + option.priceModifier).toString(),
          product_quantity: option.stock.toString(),
          product_quantity_minimum_allowed_for_purchase: option.moq?.toString() ?? '',
          product_media_main_image_url: option.image ?? '',
          product_variation_id: option.id,
          product_variation_sku: option.sku,
          product_variation_name: formatVariationSelectionLabel([{ name: variation.name, value: option.name }]),
          ajj_row_kind: 'option_variation',
          ...formatVariationSelectionColumns([{ name: variation.name, value: option.name }], variationOptionHeaders),
        });
      });
    });
  }

  return productRows.map((row) => headers.map((header) => row[header] ?? ''));
}

function getProductInternalId(product: Product): string {
  return product.ecwidId?.toString() || product.id;
}

function formatVariationSelectionLabel(options: CsvProductCombination['options']): string {
  return options
    .map((option) => `${option.name}: ${option.value}`)
    .join(' / ');
}

function formatVariationSelectionColumns(
  options: CsvProductCombination['options'],
  variationOptionHeaders: EcwidVariationOptionHeader[]
): Record<string, string> {
  const valuesByVariation = new Map(options.map((option) => [option.name, option.value]));

  return Object.fromEntries(
    variationOptionHeaders.map((variationOptionHeader) => [
      variationOptionHeader.header,
      valuesByVariation.get(variationOptionHeader.variationName) ?? '',
    ])
  ) as Record<string, string>;
}

function parseReadableVariationColumns(headers: string[], row: string[], baseSku: string): ProductVariation[] {
  const variationIndexes = getReadableVariationIndexes(headers);

  return variationIndexes
    .map((variationIndex, index) => {
      const name = getCell(headers, row, `variation_${variationIndex}_name`).trim();
      const optionNames = parseAlignedValues(getCell(headers, row, `variation_${variationIndex}_options`));

      if (!name && optionNames.length === 0) return null;
      if (!name) return null;

      const skus = parseAlignedValues(getCell(headers, row, `variation_${variationIndex}_skus`));
      const stocks = parseAlignedValues(getCell(headers, row, `variation_${variationIndex}_stock`));
      const priceAdjustments = parseAlignedValues(getCell(headers, row, `variation_${variationIndex}_price_adjustments`));
      const moqs = parseAlignedValues(getCell(headers, row, `variation_${variationIndex}_moqs`));
      const images = parseAlignedValues(getCell(headers, row, `variation_${variationIndex}_images`));

      const options = optionNames
        .map((optionName, optionIndex) => {
          const trimmedOptionName = optionName.trim();
          if (!trimmedOptionName) return null;

          const option: VariationOption = {
            id: `opt-${slugify(name) || index}-${slugify(trimmedOptionName) || optionIndex}`,
            name: trimmedOptionName,
            priceModifier: parseOptionalNumber(priceAdjustments[optionIndex]) ?? 0,
            sku: optionIndex < skus.length ? skus[optionIndex] : `${baseSku}-${trimmedOptionName}`.trim(),
            stock: parseOptionalNumber(stocks[optionIndex]) ?? 0,
          };

          const image = images[optionIndex];
          const moq = parseOptionalNumber(moqs[optionIndex]);
          if (image) option.image = image;
          if (moq !== undefined) option.moq = moq;

          return option;
        })
        .filter((option): option is VariationOption => option !== null);

      return {
        id: `var-${slugify(name) || index}`,
        name,
        options,
      };
    })
    .filter((variation): variation is ProductVariation => variation !== null);
}

function getReadableVariationIndexes(headers: string[]): number[] {
  const indexes = new Set<number>();

  headers.forEach((header) => {
    const match = header.match(/^variation_(\d+)_name$/);
    if (!match) return;
    indexes.add(Number(match[1]));
  });

  return Array.from(indexes).sort((a, b) => a - b);
}

function parseIndexedCombinationColumns(
  headers: string[],
  row: string[],
  basePrice: number
): Product['combinations'] {
  const combinationIndexes = getReadableCombinationIndexes(headers);
  if (combinationIndexes.length === 0) return undefined;

  const combinations = combinationIndexes
    .map((combinationIndex, index): CsvProductCombination | null => {
      const optionText = getCell(headers, row, `combination_${combinationIndex}_options`).trim();
      const options = parseCombinationOptions(optionText);
      if (options.length === 0) return null;

      const id = getCell(headers, row, `combination_${combinationIndex}_id`).trim();
      const sku = getCell(headers, row, `combination_${combinationIndex}_sku`).trim();
      const stock = parseOptionalNumber(getCell(headers, row, `combination_${combinationIndex}_stock`));
      const combination: CsvProductCombination = {
        id: parseCombinationId(id) ?? `combo-${index}`,
        options,
        price: parseOptionalNumber(getCell(headers, row, `combination_${combinationIndex}_price`)) ?? basePrice,
      };

      if (sku) combination.sku = sku;
      if (stock !== undefined) combination.stock = stock;

      return combination;
    })
    .filter((combination): combination is CsvProductCombination => combination !== null);

  return combinations.length > 0 ? combinations : undefined;
}

function getReadableCombinationIndexes(headers: string[]): number[] {
  const indexes = new Set<number>();

  headers.forEach((header) => {
    const match = header.match(/^combination_(\d+)_options$/);
    if (!match) return;
    indexes.add(Number(match[1]));
  });

  return Array.from(indexes).sort((a, b) => a - b);
}

function parseLegacyCombinationColumns(
  headers: string[],
  row: string[],
  basePrice: number
): Product['combinations'] {
  const optionTexts = parseAlignedValues(getCell(headers, row, 'combination_options'));
  if (optionTexts.length === 0) return undefined;

  const skus = parseAlignedValues(getCell(headers, row, 'combination_skus'));
  const prices = parseAlignedValues(getCell(headers, row, 'combination_prices'));
  const stocks = parseAlignedValues(getCell(headers, row, 'combination_stock'));
  const combinations = optionTexts
    .map((optionText, index): CsvProductCombination | null => {
      const options = parseCombinationOptions(optionText);
      if (options.length === 0) return null;

      const combination: CsvProductCombination = {
        id: `combo-${index}`,
        options,
        price: parseOptionalNumber(prices[index]) ?? basePrice,
      };

      const sku = skus[index];
      const stock = parseOptionalNumber(stocks[index]);
      if (sku) combination.sku = sku;
      if (stock !== undefined) combination.stock = stock;

      return combination;
    })
    .filter((combination): combination is CsvProductCombination => combination !== null);

  return combinations.length > 0 ? combinations : undefined;
}

function parseCombinationOptions(value: string): CsvProductCombination['options'] {
  const trimmedValue = value.trim();
  if (!trimmedValue) return [];

  if (trimmedValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedValue) as { name?: unknown; value?: unknown }[];
      if (Array.isArray(parsed)) {
        return parsed
          .map((option) => ({
            name: String(option?.name ?? '').trim(),
            value: String(option?.value ?? '').trim(),
          }))
          .filter((option) => option.name && option.value);
      }
    } catch {
      // Fall back to the readable name=value format below.
    }
  }

  return splitCombinationOptionText(trimmedValue)
    .map((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return null;

      const name = part.slice(0, separatorIndex).trim();
      const optionValue = part.slice(separatorIndex + 1).trim();
      if (!name || !optionValue) return null;

      return { name, value: optionValue };
    })
    .filter((option): option is { name: string; value: string } => option !== null);
}

function splitCombinationOptionText(value: string): string[] {
  return value.split(/\s+\/\s+|\/(?=[^/=\r\n]{1,80}=)/);
}

function parseCombinationId(value: string): string | number | undefined {
  if (!value) return undefined;
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue.toString() === value
    ? numericValue
    : value;
}

function compareRoundTripProduct(product: Product, parsedProduct: ProductCsvImportProduct): string[] {
  const errors: string[] = [];
  const label = product.sku;

  compareScalar(errors, label, 'name', product.name, parsedProduct.name);
  compareScalar(errors, label, 'description', product.description, parsedProduct.description);
  compareScalar(errors, label, 'basePrice', product.basePrice, parsedProduct.basePrice);
  compareScalar(errors, label, 'compareAtPrice', product.compareAtPrice, parsedProduct.compareAtPrice);
  compareScalar(errors, label, 'stock', product.stock, parsedProduct.stock);
  compareScalar(errors, label, 'moq', product.moq, parsedProduct.moq);
  compareScalar(errors, label, 'ribbon', product.ribbon, parsedProduct.ribbon);
  compareScalar(errors, label, 'ribbonColor', product.ribbonColor, parsedProduct.ribbonColor);
  compareStringArray(errors, label, 'images', product.images, parsedProduct.images);
  compareVariations(errors, label, product.variations, parsedProduct.variations);
  compareCombinations(errors, label, product.combinations ?? [], parsedProduct.combinations ?? []);

  return errors;
}

function compareScalar(
  errors: string[],
  label: string,
  field: string,
  expected: unknown,
  actual: unknown
): void {
  if (normalizeComparableValue(expected) === normalizeComparableValue(actual)) return;
  errors.push(`Product ${label}: ${field} did not round-trip correctly.`);
}

function compareStringArray(
  errors: string[],
  label: string,
  field: string,
  expected: string[],
  actual: string[]
): void {
  if (expected.length === actual.length && expected.every((value, index) => value === actual[index])) return;
  errors.push(`Product ${label}: ${field} did not round-trip correctly.`);
}

function compareVariations(
  errors: string[],
  label: string,
  expected: ProductVariation[],
  actual: ProductVariation[]
): void {
  if (expected.length !== actual.length) {
    errors.push(`Product ${label}: variation count changed from ${expected.length} to ${actual.length}.`);
    return;
  }

  expected.forEach((variation, variationIndex) => {
    const actualVariation = actual[variationIndex];
    if (!actualVariation || variation.name !== actualVariation.name) {
      errors.push(`Product ${label}: variation ${variationIndex + 1} did not round-trip correctly.`);
      return;
    }

    if (variation.options.length !== actualVariation.options.length) {
      errors.push(`Product ${label}: option count for ${variation.name} changed from ${variation.options.length} to ${actualVariation.options.length}.`);
      return;
    }

    variation.options.forEach((option, optionIndex) => {
      const actualOption = actualVariation.options[optionIndex];
      if (!actualOption) {
        errors.push(`Product ${label}: option ${option.name} was not found after round-trip.`);
        return;
      }

      const optionLabel = `${variation.name}/${option.name}`;
      compareScalar(errors, label, `${optionLabel} name`, option.name, actualOption.name);
      compareScalar(errors, label, `${optionLabel} sku`, option.sku, actualOption.sku);
      compareScalar(errors, label, `${optionLabel} stock`, option.stock, actualOption.stock);
      compareScalar(errors, label, `${optionLabel} priceModifier`, option.priceModifier, actualOption.priceModifier);
      compareScalar(errors, label, `${optionLabel} moq`, option.moq, actualOption.moq);
    });
  });
}

function compareCombinations(
  errors: string[],
  label: string,
  expected: CsvProductCombination[],
  actual: CsvProductCombination[]
): void {
  if (expected.length !== actual.length) {
    errors.push(`Product ${label}: combination count changed from ${expected.length} to ${actual.length}.`);
    return;
  }

  expected.forEach((combination, index) => {
    const actualCombination = actual[index];
    if (!actualCombination) {
      errors.push(`Product ${label}: combination ${index + 1} was not found after round-trip.`);
      return;
    }

    compareScalar(errors, label, `combination ${index + 1} id`, combination.id, actualCombination.id);
    compareScalar(errors, label, `combination ${index + 1} sku`, combination.sku, actualCombination.sku);
    compareScalar(errors, label, `combination ${index + 1} price`, combination.price, actualCombination.price);
    compareScalar(errors, label, `combination ${index + 1} stock`, combination.stock, actualCombination.stock);

    const expectedOptions = formatComparableCombinationOptions(combination.options);
    const actualOptions = formatComparableCombinationOptions(actualCombination.options);
    compareStringArray(errors, label, `combination ${index + 1} options`, expectedOptions, actualOptions);
  });
}

function formatComparableCombinationOptions(options: CsvProductCombination['options']): string[] {
  return options
    .map((option) => `${option.name.trim()}=${option.value.trim()}`)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeComparableValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value.trim() : String(value);
}

function normalizeVariations(variations: ProductVariation[], baseSku: string): ProductVariation[] {
  if (!Array.isArray(variations)) return [];

  return variations
    .map((variation, variationIndex) => {
      const name = String(variation?.name ?? '').trim();
      if (!name || !Array.isArray(variation?.options)) return null;

      const options = variation.options
        .map((option, optionIndex) => normalizeVariationOption(option, name, variationIndex, optionIndex, baseSku))
        .filter((option): option is VariationOption => option !== null);

      if (options.length === 0) return null;

      return {
        id: String(variation.id || `var-${slugify(name) || variationIndex}`),
        name,
        options,
      };
    })
    .filter((variation): variation is ProductVariation => variation !== null);
}

function normalizeVariationOption(
  option: VariationOption,
  variationName: string,
  variationIndex: number,
  optionIndex: number,
  baseSku: string
): VariationOption | null {
  const name = String(option?.name ?? '').trim();
  if (!name) return null;

  return {
    id: String(option.id || `opt-${slugify(variationName) || variationIndex}-${slugify(name) || optionIndex}`),
    name,
    priceModifier: toFiniteNumber(option.priceModifier, 0),
    sku: typeof option.sku === 'string' ? option.sku.trim() : `${baseSku}-${name}`.trim(),
    stock: toFiniteNumber(option.stock, 0),
    image: typeof option.image === 'string' && option.image.trim() ? option.image.trim() : undefined,
    moq: option.moq !== undefined ? toFiniteNumber(option.moq, 0) : undefined,
  };
}

function normalizeCombinations(
  combinations: CsvProductCombination[],
  basePrice: number
): Product['combinations'] {
  if (!Array.isArray(combinations)) return undefined;

  const normalized = combinations
    .map((combination, index): CsvProductCombination | null => {
      if (!Array.isArray(combination?.options)) return null;
      const options = combination.options
        .map((option) => ({
          name: String(option?.name ?? '').trim(),
          value: String(option?.value ?? '').trim(),
        }))
        .filter((option) => option.name && option.value);

      if (options.length === 0) return null;

      const normalizedCombination: CsvProductCombination = {
        id: combination.id ?? `combo-${index}`,
        options,
        price: toFiniteNumber(combination.price, basePrice),
      };

      if (typeof combination.sku === 'string' && combination.sku.trim()) {
        normalizedCombination.sku = combination.sku.trim();
      }
      if (combination.stock !== undefined) {
        normalizedCombination.stock = toFiniteNumber(combination.stock, 0);
      }

      return normalizedCombination;
    })
    .filter((combination): combination is CsvProductCombination => combination !== null);

  return normalized.length > 0 ? normalized : undefined;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\r' || char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (char === '\r' && content[index + 1] === '\n') index += 1;
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function getEcwidVariationColumns(headers: string[]): { index: number; name: string }[] {
  return headers
    .map((header, index) => {
      const match = header.match(/^product_variation_option_(.+)$/);
      if (!match) return null;
      const name = match[1].replace(/^\{|\}$/g, '').trim();
      return name ? { index, name } : null;
    })
    .filter((column): column is { index: number; name: string } => column !== null);
}

function getHeaderIndex(headers: string[], name: string): number {
  const exactIndex = headers.indexOf(name);
  if (exactIndex >= 0) return exactIndex;
  const lowerName = name.toLowerCase();
  return headers.findIndex((header) => header.toLowerCase() === lowerName);
}

function getCell(headers: string[], row: string[], name: string): string {
  const index = getHeaderIndex(headers, name);
  return index >= 0 ? row[index] ?? '' : '';
}

function firstCell(headers: string[], row: string[], names: string[]): string | undefined {
  for (const name of names) {
    const value = getCell(headers, row, name);
    if (value !== '') return value;
  }
  return undefined;
}

function parseJsonArray<T>(raw: string | undefined, label: string, warnings: string[]): T[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T[];
    warnings.push(`${label} is not a JSON array and was ignored.`);
  } catch {
    warnings.push(`${label} could not be parsed and was ignored.`);
  }
  return [];
}

function parseRequiredNumber(raw: string | undefined, label: string, errors: string[]): number | null {
  const value = parseOptionalNumber(raw);
  if (value === undefined) {
    errors.push(`${label} is required.`);
    return null;
  }
  return value;
}

function parseOptionalNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const text = String(raw ?? '').trim();
  if (!text) return undefined;
  const match = text.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function parseOptionalIdentifierNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 0 ? raw : undefined;
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : undefined;
}

function toFiniteNumber(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = parseOptionalNumber(raw);
  return parsed ?? fallback;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return fallback;
  if (['true', 'yes', 'y', '1', 'active', 'enabled'].includes(value)) return true;
  if (['false', 'no', 'n', '0', 'inactive', 'disabled'].includes(value)) return false;
  return fallback;
}

function splitList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return trimmed
    .split(/\s+\|\s+|\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAlignedValues(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? '').trim());
      }
    } catch {
      // Fall through to delimiter parsing for older or hand-edited files.
    }
  }

  return trimmed
    .split(/\s+\|\s+|\s*;\s*/)
    .map((item) => item.trim());
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as Partial<T>;
}
