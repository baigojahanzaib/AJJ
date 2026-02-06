import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Product } from '@/types';

const IMAGE_CACHE_INDEX_KEY = '@salesapp_offline_image_cache_index';
const IMAGE_CACHE_DIR = `${FileSystem.documentDirectory}offline-cache/product-images`;

export type ImageCacheIndex = Record<string, string>;

export interface CacheProductImagesOptions {
  cacheMode?: 'primary' | 'all';
  concurrency?: number;
  maxImages?: number;
}

export interface CacheProductImagesResult {
  index: ImageCacheIndex;
  updated: boolean;
  total: number;
  downloaded: number;
  reused: number;
  failed: number;
}

function normalizeUri(uri: string): string {
  return uri.trim();
}

function isRemoteHttpUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

function getFileExtensionFromUri(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) return '.jpg';

  const ext = match[1].toLowerCase();
  if (ext.length > 5) return '.jpg';
  return `.${ext}`;
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

async function ensureImageCacheDir(): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_DIR, { intermediates: true });
  } catch {
    // Directory may already exist.
  }
}

async function fileExists(fileUri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    return !!info.exists;
  } catch {
    return false;
  }
}

async function saveImageCacheIndex(index: ImageCacheIndex): Promise<void> {
  await AsyncStorage.setItem(IMAGE_CACHE_INDEX_KEY, JSON.stringify(index));
}

function collectProductImageUrls(products: Product[], mode: 'primary' | 'all'): string[] {
  const urls = new Set<string>();

  for (const product of products) {
    if (mode === 'all') {
      product.images.forEach((uri) => {
        const normalized = normalizeUri(uri);
        if (normalized) urls.add(normalized);
      });
    } else {
      const first = product.images[0] ? normalizeUri(product.images[0]) : '';
      if (first) urls.add(first);
    }

    product.variations.forEach((variation) => {
      variation.options.forEach((option) => {
        if (!option.image) return;
        const normalized = normalizeUri(option.image);
        if (normalized) urls.add(normalized);
      });
    });
  }

  return Array.from(urls).filter(isRemoteHttpUri);
}

async function withConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  if (values.length === 0) return;

  const safeConcurrency = Math.max(1, Math.min(concurrency, 12));
  let cursor = 0;

  const workers = Array.from({ length: Math.min(safeConcurrency, values.length) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= values.length) return;
      await worker(values[current]);
    }
  });

  await Promise.all(workers);
}

export async function loadImageCacheIndex(): Promise<ImageCacheIndex> {
  try {
    const raw = await AsyncStorage.getItem(IMAGE_CACHE_INDEX_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([key, value]) => typeof key === 'string' && typeof value === 'string'
      )
    ) as ImageCacheIndex;
  } catch (error) {
    console.error('[ImageCache] Failed to load image cache index:', error);
    return {};
  }
}

export function resolveCachedImageUri(uri: string | null | undefined, index: ImageCacheIndex): string {
  if (!uri) return '';
  const normalized = normalizeUri(uri);
  return index[normalized] || normalized;
}

export async function cacheProductImages(
  products: Product[],
  currentIndex: ImageCacheIndex,
  options?: CacheProductImagesOptions
): Promise<CacheProductImagesResult> {
  const mode = options?.cacheMode ?? 'primary';
  const concurrency = options?.concurrency ?? 6;
  const candidateUrls = collectProductImageUrls(products, mode);
  const urls = options?.maxImages ? candidateUrls.slice(0, options.maxImages) : candidateUrls;

  if (urls.length === 0) {
    return {
      index: currentIndex,
      updated: false,
      total: 0,
      downloaded: 0,
      reused: 0,
      failed: 0,
    };
  }

  await ensureImageCacheDir();

  const nextIndex: ImageCacheIndex = { ...currentIndex };
  let updated = false;
  let downloaded = 0;
  let reused = 0;
  let failed = 0;

  await withConcurrency(urls, concurrency, async (url) => {
    const normalized = normalizeUri(url);
    const existingLocalUri = nextIndex[normalized];

    if (existingLocalUri) {
      const exists = await fileExists(existingLocalUri);
      if (exists) {
        reused += 1;
        return;
      }

      delete nextIndex[normalized];
      updated = true;
    }

    const fileName = `${hashString(normalized)}${getFileExtensionFromUri(normalized)}`;
    const localUri = `${IMAGE_CACHE_DIR}/${fileName}`;

    try {
      const result = await FileSystem.downloadAsync(normalized, localUri);
      if (result.status >= 200 && result.status < 300) {
        nextIndex[normalized] = localUri;
        downloaded += 1;
        updated = true;
        return;
      }

      failed += 1;
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    } catch (error) {
      failed += 1;
      console.warn('[ImageCache] Failed downloading image:', normalized, error);
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
  });

  if (updated) {
    await saveImageCacheIndex(nextIndex);
  }

  return {
    index: nextIndex,
    updated,
    total: urls.length,
    downloaded,
    reused,
    failed,
  };
}
