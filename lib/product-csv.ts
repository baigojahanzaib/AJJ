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

const PRODUCT_CSV_HEADERS = [
  'format_version',
  'product_id',
  'ecwid_id',
  'sku',
  'name',
  'description',
  'base_price',
  'compare_at_price',
  'stock',
  'moq',
  'category_id',
  'category_name',
  'is_active',
  'primary_image',
  'images',
  'images_json',
  'ribbon',
  'ribbon_color',
  'variations_json',
  'variation_options',
  'combinations_json',
  'combination_skus',
] as const;

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
  const rows = [
    PRODUCT_CSV_HEADERS,
    ...products.map((product) => {
      const category = categoryById.get(product.categoryId);
      const combinations = product.combinations ?? [];

      return [
        'ajj-products-v1',
        product.id,
        product.ecwidId?.toString() ?? '',
        product.sku,
        product.name,
        product.description,
        product.basePrice.toString(),
        product.compareAtPrice?.toString() ?? '',
        product.stock.toString(),
        product.moq?.toString() ?? '',
        product.categoryId,
        category?.name ?? '',
        product.isActive ? 'true' : 'false',
        product.images[0] ?? '',
        product.images.join(' | '),
        JSON.stringify(product.images),
        product.ribbon ?? '',
        product.ribbonColor ?? '',
        JSON.stringify(product.variations),
        formatVariationSummary(product.variations),
        JSON.stringify(combinations),
        formatCombinationSummary(combinations),
      ];
    }),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
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

  const images = parseImagesFromAppRow(headers, row.values);

  return {
    id: firstCell(headers, row.values, ['product_id', 'id'])?.trim() || undefined,
    ecwidId: parseOptionalNumber(firstCell(headers, row.values, ['ecwid_id', 'product_internal_id'])),
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
    variations: normalizeVariations(variations, sku),
    combinations: normalizeCombinations(combinations, basePrice),
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
      getCell(headers, row.values, 'product_internal_id') ||
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
  const name = getCell(headers, row, 'product_name').trim();
  const sku = getCell(headers, row, 'product_sku').trim() || `ECWID-${getCell(headers, row, 'product_internal_id') || productRow.rowNumber}`;

  if (!name) {
    errors.push(`Row ${productRow.rowNumber}: product_name is required.`);
    return null;
  }

  const basePrice = parseRequiredNumber(getCell(headers, row, 'product_price'), `Row ${productRow.rowNumber}: product_price`, errors);
  if (basePrice === null) return null;

  const stock = parseOptionalNumber(getCell(headers, row, 'product_quantity')) ?? 0;
  const images = collectEcwidProductImages(headers, row);
  const variations = buildEcwidVariations(headers, group, sku, basePrice, stock);
  const combinations = buildEcwidCombinations(headers, group, basePrice);
  const fallbackImages = collectEcwidVariationImages(headers, group);

  return {
    ecwidId: parseOptionalNumber(getCell(headers, row, 'product_internal_id')),
    sku,
    name,
    description: stripHtml(getCell(headers, row, 'product_description')),
    basePrice,
    compareAtPrice: parseOptionalNumber(getCell(headers, row, 'product_compare_to_price')),
    images: images.length > 0 ? images : (fallbackImages.length > 0 ? fallbackImages : ['https://via.placeholder.com/300']),
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
    const key = normalizedName.toLowerCase();
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
    const optionKey = normalizedOptionName.toLowerCase();
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
      stock: baseStock,
    });
  }

  const variationColumns = getEcwidVariationColumns(headers);
  group.variationRows.forEach((variationRow) => {
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

    selectedOptions.forEach((selectedOption) => {
      addOption(selectedOption.variationName, selectedOption.optionName, {
        stock: variationStock ?? baseStock,
      });

      if (variationImage) {
        const key = `${selectedOption.variationName.toLowerCase()}:${selectedOption.optionName.toLowerCase()}`;
        if (!optionImages.has(key)) optionImages.set(key, new Set());
        optionImages.get(key)!.add(variationImage);
      }
    });

    if (selectedOptions.length === 1) {
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
      const imageKey = `${draftVariation.name.toLowerCase()}:${option.name.toLowerCase()}`;
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
      sku: option.sku || `${baseSku}-${option.name}`.trim(),
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
      const options = variationColumns
        .map((column) => ({
          name: column.name,
          value: variationRow.values[column.index]?.trim() ?? '',
        }))
        .filter((option) => option.value !== '');

      if (options.length === 0) return null;

      const combination: CsvProductCombination = {
        id: getCell(headers, variationRow.values, 'product_internal_id') ?
          `${getCell(headers, variationRow.values, 'product_internal_id')}-${variationRow.rowNumber}` :
          `csv-${variationRow.rowNumber}`,
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
    sku: String(option.sku || `${baseSku}-${name}`).trim(),
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatVariationSummary(variations: ProductVariation[]): string {
  return variations
    .map((variation) => {
      const options = variation.options
        .map((option) => {
          const details = [
            option.sku ? `sku:${option.sku}` : '',
            option.stock !== undefined ? `stock:${option.stock}` : '',
            option.moq !== undefined ? `moq:${option.moq}` : '',
            option.priceModifier ? `modifier:${option.priceModifier}` : '',
          ].filter(Boolean);
          return details.length > 0 ? `${option.name} (${details.join(', ')})` : option.name;
        })
        .join(' | ');

      return `${variation.name}: ${options}`;
    })
    .join(' ; ');
}

function formatCombinationSummary(combinations: Product['combinations']): string {
  if (!combinations?.length) return '';

  return combinations
    .map((combination) => {
      const options = combination.options.map((option) => `${option.name}=${option.value}`).join(' / ');
      const details = [
        combination.sku ? `sku:${combination.sku}` : '',
        `price:${combination.price}`,
        combination.stock !== undefined ? `stock:${combination.stock}` : '',
      ].filter(Boolean);
      return `${options} (${details.join(', ')})`;
    })
    .join(' ; ');
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
