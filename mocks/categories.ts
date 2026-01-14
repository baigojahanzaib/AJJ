import { Category } from '@/types';

export const mockCategories: Category[] = [
  {
    id: 'cat-001',
    name: 'Electronics',
    description: 'Electronic devices and accessories',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-002',
    name: 'Clothing',
    description: 'Apparel and fashion items',
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=300&fit=crop',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-003',
    name: 'Home & Garden',
    description: 'Home decor and garden supplies',
    image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&h=300&fit=crop',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-004',
    name: 'Sports & Outdoors',
    description: 'Sports equipment and outdoor gear',
    image: 'https://images.unsplash.com/photo-1461896836934- voices-586d?w=400&h=300&fit=crop',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-005',
    name: 'Beauty & Health',
    description: 'Beauty products and health supplies',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=300&fit=crop',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cat-006',
    name: 'Office Supplies',
    description: 'Office equipment and stationery',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

export const getCategoryById = (id: string): Category | undefined => {
  return mockCategories.find(cat => cat.id === id);
};

export const getActiveCategories = (): Category[] => {
  return mockCategories.filter(cat => cat.isActive);
};
