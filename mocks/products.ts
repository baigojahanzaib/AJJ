import { Product } from '@/types';

export const mockProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-canceling wireless headphones with 30-hour battery life. Features advanced audio technology for crystal-clear sound.',
    sku: 'ELEC-WBH-001',
    basePrice: 149.99,
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-001',
    isActive: true,
    stock: 150,
    variations: [
      {
        id: 'var-001',
        name: 'Color',
        options: [
          { id: 'opt-001', name: 'Matte Black', priceModifier: 0, sku: 'WBH-BLK', stock: 50 },
          { id: 'opt-002', name: 'Pearl White', priceModifier: 10, sku: 'WBH-WHT', stock: 50 },
          { id: 'opt-003', name: 'Navy Blue', priceModifier: 10, sku: 'WBH-BLU', stock: 50 },
        ],
      },
    ],
    createdAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'prod-002',
    name: 'Smart Fitness Watch',
    description: 'Advanced fitness tracker with heart rate monitoring, GPS, and 7-day battery life. Water resistant up to 50m.',
    sku: 'ELEC-SFW-001',
    basePrice: 299.99,
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-001',
    isActive: true,
    stock: 75,
    variations: [
      {
        id: 'var-002',
        name: 'Size',
        options: [
          { id: 'opt-004', name: '40mm', priceModifier: 0, sku: 'SFW-40', stock: 40 },
          { id: 'opt-005', name: '44mm', priceModifier: 30, sku: 'SFW-44', stock: 35 },
        ],
      },
      {
        id: 'var-003',
        name: 'Band',
        options: [
          { id: 'opt-006', name: 'Sport Band', priceModifier: 0, sku: 'SFW-SPT', stock: 50 },
          { id: 'opt-007', name: 'Leather Strap', priceModifier: 50, sku: 'SFW-LTH', stock: 25 },
        ],
      },
    ],
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'prod-003',
    name: 'Premium Cotton T-Shirt',
    description: 'Ultra-soft 100% organic cotton t-shirt. Pre-shrunk fabric with reinforced stitching for durability.',
    sku: 'CLTH-PCT-001',
    basePrice: 34.99,
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-002',
    isActive: true,
    stock: 500,
    variations: [
      {
        id: 'var-004',
        name: 'Size',
        options: [
          { id: 'opt-008', name: 'S', priceModifier: 0, sku: 'PCT-S', stock: 100 },
          { id: 'opt-009', name: 'M', priceModifier: 0, sku: 'PCT-M', stock: 150 },
          { id: 'opt-010', name: 'L', priceModifier: 0, sku: 'PCT-L', stock: 150 },
          { id: 'opt-011', name: 'XL', priceModifier: 5, sku: 'PCT-XL', stock: 100 },
        ],
      },
      {
        id: 'var-005',
        name: 'Color',
        options: [
          { id: 'opt-012', name: 'White', priceModifier: 0, sku: 'PCT-WHT', stock: 200 },
          { id: 'opt-013', name: 'Black', priceModifier: 0, sku: 'PCT-BLK', stock: 200 },
          { id: 'opt-014', name: 'Gray', priceModifier: 0, sku: 'PCT-GRY', stock: 100 },
        ],
      },
    ],
    createdAt: '2024-01-20T00:00:00Z',
  },
  {
    id: 'prod-004',
    name: 'Ceramic Plant Pot Set',
    description: 'Set of 3 minimalist ceramic plant pots with drainage holes. Perfect for indoor plants and succulents.',
    sku: 'HOME-CPP-001',
    basePrice: 45.99,
    images: [
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-003',
    isActive: true,
    stock: 200,
    variations: [
      {
        id: 'var-006',
        name: 'Color',
        options: [
          { id: 'opt-015', name: 'Terracotta', priceModifier: 0, sku: 'CPP-TER', stock: 80 },
          { id: 'opt-016', name: 'White', priceModifier: 0, sku: 'CPP-WHT', stock: 80 },
          { id: 'opt-017', name: 'Sage Green', priceModifier: 5, sku: 'CPP-SGR', stock: 40 },
        ],
      },
    ],
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'prod-005',
    name: 'Yoga Mat Premium',
    description: 'Extra thick 6mm yoga mat with non-slip surface. Eco-friendly TPE material, includes carrying strap.',
    sku: 'SPRT-YMP-001',
    basePrice: 59.99,
    images: [
      'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-004',
    isActive: true,
    stock: 120,
    variations: [
      {
        id: 'var-007',
        name: 'Color',
        options: [
          { id: 'opt-018', name: 'Purple', priceModifier: 0, sku: 'YMP-PUR', stock: 40 },
          { id: 'opt-019', name: 'Teal', priceModifier: 0, sku: 'YMP-TEA', stock: 40 },
          { id: 'opt-020', name: 'Coral', priceModifier: 0, sku: 'YMP-COR', stock: 40 },
        ],
      },
    ],
    createdAt: '2024-02-10T00:00:00Z',
  },
  {
    id: 'prod-006',
    name: 'Natural Skincare Set',
    description: 'Complete skincare routine with cleanser, toner, and moisturizer. Made with organic ingredients.',
    sku: 'BEAU-NSS-001',
    basePrice: 89.99,
    images: [
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-005',
    isActive: true,
    stock: 80,
    variations: [
      {
        id: 'var-008',
        name: 'Skin Type',
        options: [
          { id: 'opt-021', name: 'Normal/Combination', priceModifier: 0, sku: 'NSS-NRM', stock: 30 },
          { id: 'opt-022', name: 'Dry', priceModifier: 0, sku: 'NSS-DRY', stock: 25 },
          { id: 'opt-023', name: 'Oily', priceModifier: 0, sku: 'NSS-OIL', stock: 25 },
        ],
      },
    ],
    createdAt: '2024-02-15T00:00:00Z',
  },
  {
    id: 'prod-007',
    name: 'Portable Bluetooth Speaker',
    description: 'Compact waterproof speaker with 360° sound. 12-hour playtime, perfect for outdoor adventures.',
    sku: 'ELEC-PBS-001',
    basePrice: 79.99,
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-001',
    isActive: true,
    stock: 200,
    variations: [
      {
        id: 'var-009',
        name: 'Color',
        options: [
          { id: 'opt-024', name: 'Black', priceModifier: 0, sku: 'PBS-BLK', stock: 80 },
          { id: 'opt-025', name: 'Red', priceModifier: 0, sku: 'PBS-RED', stock: 60 },
          { id: 'opt-026', name: 'Blue', priceModifier: 0, sku: 'PBS-BLU', stock: 60 },
        ],
      },
    ],
    createdAt: '2024-02-20T00:00:00Z',
  },
  {
    id: 'prod-008',
    name: 'Denim Jacket Classic',
    description: 'Timeless denim jacket with button closure. Stonewashed finish for a vintage look.',
    sku: 'CLTH-DJC-001',
    basePrice: 89.99,
    images: [
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&h=600&fit=crop',
    ],
    categoryId: 'cat-002',
    isActive: true,
    stock: 150,
    variations: [
      {
        id: 'var-010',
        name: 'Size',
        options: [
          { id: 'opt-027', name: 'S', priceModifier: 0, sku: 'DJC-S', stock: 30 },
          { id: 'opt-028', name: 'M', priceModifier: 0, sku: 'DJC-M', stock: 50 },
          { id: 'opt-029', name: 'L', priceModifier: 0, sku: 'DJC-L', stock: 50 },
          { id: 'opt-030', name: 'XL', priceModifier: 10, sku: 'DJC-XL', stock: 20 },
        ],
      },
      {
        id: 'var-011',
        name: 'Wash',
        options: [
          { id: 'opt-031', name: 'Light Wash', priceModifier: 0, sku: 'DJC-LW', stock: 75 },
          { id: 'opt-032', name: 'Dark Wash', priceModifier: 0, sku: 'DJC-DW', stock: 75 },
        ],
      },
    ],
    createdAt: '2024-03-01T00:00:00Z',
  },
];

export const getProductById = (id: string): Product | undefined => {
  return mockProducts.find(product => product.id === id);
};

export const getActiveProducts = (): Product[] => {
  return mockProducts.filter(product => product.isActive);
};

export const getProductsByCategory = (categoryId: string): Product[] => {
  return mockProducts.filter(product => product.categoryId === categoryId && product.isActive);
};

export const searchProducts = (query: string): Product[] => {
  const lowerQuery = query.toLowerCase();
  return mockProducts.filter(product => 
    product.isActive && (
      product.name.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery) ||
      product.sku.toLowerCase().includes(lowerQuery)
    )
  );
};
