export type CatalogSource = 'website' | 'supabase';

const normalizedCatalogSource = (process.env.EXPO_PUBLIC_CATALOG_SOURCE ?? '')
  .trim()
  .toLowerCase();

export function getCatalogSource(): CatalogSource {
  return normalizedCatalogSource === 'supabase' ? 'supabase' : 'website';
}

export function getCatalogSourceLabel(source: CatalogSource = getCatalogSource()): string {
  return source === 'supabase' ? 'Supabase' : 'Website API';
}
