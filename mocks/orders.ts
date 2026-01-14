import { Order } from '@/types';

export const mockOrders: Order[] = [
  {
    id: 'ord-001',
    orderNumber: 'ORD-2024-0001',
    salesRepId: 'sales-001',
    salesRepName: 'Sarah Mitchell',
    customerName: 'Acme Corporation',
    customerPhone: '+1 (555) 300-0001',
    customerEmail: 'purchasing@acme.com',
    customerAddress: '123 Business Ave, Suite 100, New York, NY 10001',
    items: [
      {
        id: 'item-001',
        productId: 'prod-001',
        productName: 'Wireless Bluetooth Headphones',
        productSku: 'ELEC-WBH-001',
        productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-001', variationName: 'Color', optionId: 'opt-001', optionName: 'Matte Black', priceModifier: 0 },
        ],
        quantity: 10,
        unitPrice: 149.99,
        totalPrice: 1499.90,
      },
      {
        id: 'item-002',
        productId: 'prod-002',
        productName: 'Smart Fitness Watch',
        productSku: 'ELEC-SFW-001',
        productImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-002', variationName: 'Size', optionId: 'opt-005', optionName: '44mm', priceModifier: 30 },
          { variationId: 'var-003', variationName: 'Band', optionId: 'opt-006', optionName: 'Sport Band', priceModifier: 0 },
        ],
        quantity: 5,
        unitPrice: 329.99,
        totalPrice: 1649.95,
      },
    ],
    subtotal: 3149.85,
    tax: 283.49,
    discount: 0,
    total: 3433.34,
    status: 'delivered',
    notes: 'Bulk order for corporate gifts',
    createdAt: '2024-01-20T10:30:00Z',
    updatedAt: '2024-01-25T14:00:00Z',
  },
  {
    id: 'ord-002',
    orderNumber: 'ORD-2024-0002',
    salesRepId: 'sales-002',
    salesRepName: 'Michael Chen',
    customerName: 'TechStart Inc',
    customerPhone: '+1 (555) 300-0002',
    customerEmail: 'orders@techstart.com',
    customerAddress: '456 Innovation Blvd, San Francisco, CA 94102',
    items: [
      {
        id: 'item-003',
        productId: 'prod-003',
        productName: 'Premium Cotton T-Shirt',
        productSku: 'CLTH-PCT-001',
        productImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-004', variationName: 'Size', optionId: 'opt-009', optionName: 'M', priceModifier: 0 },
          { variationId: 'var-005', variationName: 'Color', optionId: 'opt-013', optionName: 'Black', priceModifier: 0 },
        ],
        quantity: 50,
        unitPrice: 34.99,
        totalPrice: 1749.50,
      },
    ],
    subtotal: 1749.50,
    tax: 157.46,
    discount: 100,
    total: 1806.96,
    status: 'shipped',
    notes: 'Company uniform order - embroidery needed',
    createdAt: '2024-02-05T09:15:00Z',
    updatedAt: '2024-02-08T11:30:00Z',
  },
  {
    id: 'ord-003',
    orderNumber: 'ORD-2024-0003',
    salesRepId: 'sales-001',
    salesRepName: 'Sarah Mitchell',
    customerName: 'Wellness Studio',
    customerPhone: '+1 (555) 300-0003',
    customerEmail: 'info@wellnessstudio.com',
    customerAddress: '789 Health Way, Los Angeles, CA 90001',
    items: [
      {
        id: 'item-004',
        productId: 'prod-005',
        productName: 'Yoga Mat Premium',
        productSku: 'SPRT-YMP-001',
        productImage: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-007', variationName: 'Color', optionId: 'opt-019', optionName: 'Teal', priceModifier: 0 },
        ],
        quantity: 20,
        unitPrice: 59.99,
        totalPrice: 1199.80,
      },
      {
        id: 'item-005',
        productId: 'prod-006',
        productName: 'Natural Skincare Set',
        productSku: 'BEAU-NSS-001',
        productImage: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-008', variationName: 'Skin Type', optionId: 'opt-021', optionName: 'Normal/Combination', priceModifier: 0 },
        ],
        quantity: 15,
        unitPrice: 89.99,
        totalPrice: 1349.85,
      },
    ],
    subtotal: 2549.65,
    tax: 229.47,
    discount: 50,
    total: 2729.12,
    status: 'processing',
    notes: 'Studio opening inventory',
    createdAt: '2024-02-18T14:45:00Z',
    updatedAt: '2024-02-19T09:00:00Z',
  },
  {
    id: 'ord-004',
    orderNumber: 'ORD-2024-0004',
    salesRepId: 'sales-003',
    salesRepName: 'Emily Rodriguez',
    customerName: 'Home Decor Plus',
    customerPhone: '+1 (555) 300-0004',
    customerEmail: 'orders@homedecorplus.com',
    customerAddress: '321 Design Street, Austin, TX 78701',
    items: [
      {
        id: 'item-006',
        productId: 'prod-004',
        productName: 'Ceramic Plant Pot Set',
        productSku: 'HOME-CPP-001',
        productImage: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-006', variationName: 'Color', optionId: 'opt-017', optionName: 'Sage Green', priceModifier: 5 },
        ],
        quantity: 30,
        unitPrice: 50.99,
        totalPrice: 1529.70,
      },
    ],
    subtotal: 1529.70,
    tax: 137.67,
    discount: 0,
    total: 1667.37,
    status: 'confirmed',
    notes: 'Retail store restocking',
    createdAt: '2024-02-25T11:20:00Z',
    updatedAt: '2024-02-25T15:00:00Z',
  },
  {
    id: 'ord-005',
    orderNumber: 'ORD-2024-0005',
    salesRepId: 'sales-002',
    salesRepName: 'Michael Chen',
    customerName: 'Fashion Forward LLC',
    customerPhone: '+1 (555) 300-0005',
    customerEmail: 'buying@fashionforward.com',
    customerAddress: '555 Style Ave, Miami, FL 33101',
    items: [
      {
        id: 'item-007',
        productId: 'prod-008',
        productName: 'Denim Jacket Classic',
        productSku: 'CLTH-DJC-001',
        productImage: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-010', variationName: 'Size', optionId: 'opt-028', optionName: 'M', priceModifier: 0 },
          { variationId: 'var-011', variationName: 'Wash', optionId: 'opt-031', optionName: 'Light Wash', priceModifier: 0 },
        ],
        quantity: 25,
        unitPrice: 89.99,
        totalPrice: 2249.75,
      },
    ],
    subtotal: 2249.75,
    tax: 202.48,
    discount: 0,
    total: 2452.23,
    status: 'pending',
    notes: 'Spring collection order',
    createdAt: '2024-03-01T08:00:00Z',
    updatedAt: '2024-03-01T08:00:00Z',
  },
  {
    id: 'ord-006',
    orderNumber: 'ORD-2024-0006',
    salesRepId: 'sales-001',
    salesRepName: 'Sarah Mitchell',
    customerName: 'Sound Systems Pro',
    customerPhone: '+1 (555) 300-0006',
    customerEmail: 'info@soundsystemspro.com',
    customerAddress: '999 Audio Lane, Nashville, TN 37201',
    items: [
      {
        id: 'item-008',
        productId: 'prod-007',
        productName: 'Portable Bluetooth Speaker',
        productSku: 'ELEC-PBS-001',
        productImage: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop',
        selectedVariations: [
          { variationId: 'var-009', variationName: 'Color', optionId: 'opt-024', optionName: 'Black', priceModifier: 0 },
        ],
        quantity: 40,
        unitPrice: 79.99,
        totalPrice: 3199.60,
      },
    ],
    subtotal: 3199.60,
    tax: 287.96,
    discount: 200,
    total: 3287.56,
    status: 'cancelled',
    notes: 'Order cancelled by customer',
    createdAt: '2024-02-28T16:30:00Z',
    updatedAt: '2024-03-02T10:00:00Z',
  },
];

export const getOrderById = (id: string): Order | undefined => {
  return mockOrders.find(order => order.id === id);
};

export const getOrdersBySalesRep = (salesRepId: string): Order[] => {
  return mockOrders.filter(order => order.salesRepId === salesRepId);
};

export const getOrdersByStatus = (status: string): Order[] => {
  return mockOrders.filter(order => order.status === status);
};

export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const nextNumber = mockOrders.length + 1;
  return `ORD-${year}-${nextNumber.toString().padStart(4, '0')}`;
};
