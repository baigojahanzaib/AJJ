function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseFloat(trimmed.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MOQ_KEYS = new Set([
  "moq",
  "minimumorderquantity",
  "minimumorderqty",
  "minorderquantity",
  "minorderqty",
  "minimumquantity",
  "minquantity",
  "minqty",
]);

function extractMoqFromAttributes(attributes: unknown): number | undefined {
  if (!Array.isArray(attributes)) return undefined;

  for (const attribute of attributes) {
    if (!attribute || typeof attribute !== "object") continue;
    const attr = attribute as Record<string, unknown>;
    const normalizedName = normalizeKey(attr.name);
    const normalizedType = normalizeKey(attr.type);
    const looksLikeMoq =
      MOQ_KEYS.has(normalizedName) ||
      (normalizedType === "moq" && parsePositiveNumber(attr.value) !== undefined);

    if (!looksLikeMoq) continue;

    const parsed = parsePositiveNumber(attr.value);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

function extractMoqFromCombinations(combinations: unknown): number | undefined {
  if (!Array.isArray(combinations)) return undefined;

  let highest: number | undefined;
  for (const combination of combinations) {
    if (!combination || typeof combination !== "object") continue;
    const combo = combination as Record<string, unknown>;
    const parsed = parsePositiveNumber(combo.minPurchaseQuantity);
    if (parsed === undefined) continue;
    if (highest === undefined || parsed > highest) highest = parsed;
  }

  return highest;
}

/**
 * Ecwid can store MOQ either in a custom attribute (legacy) or as minPurchaseQuantity.
 * We prioritize minPurchaseQuantity when it is explicitly greater than 1.
 */
export function extractEcwidMoq(product: unknown): number {
  if (!product || typeof product !== "object") return 1;
  const prod = product as Record<string, unknown>;

  const attributeMoq = extractMoqFromAttributes(prod.attributes);
  const minPurchaseQuantity = parsePositiveNumber(prod.minPurchaseQuantity);
  const comboMoq = extractMoqFromCombinations(prod.combinations);

  if (minPurchaseQuantity !== undefined && minPurchaseQuantity > 1) {
    return minPurchaseQuantity;
  }

  if (attributeMoq !== undefined) {
    return attributeMoq;
  }

  if (comboMoq !== undefined && comboMoq > 1) {
    return comboMoq;
  }

  if (minPurchaseQuantity !== undefined) {
    return minPurchaseQuantity;
  }

  return 1;
}
