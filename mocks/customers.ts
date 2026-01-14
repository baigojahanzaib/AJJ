import { Customer } from '@/types';

export const mockCustomers: Customer[] = [
  {
    id: 'cust-001',
    name: 'Acme Corporation',
    phone: '+1 (555) 300-0001',
    email: 'purchasing@acme.com',
    address: '123 Business Ave, Suite 100, New York, NY 10001',
    company: 'Acme Corporation',
    isActive: true,
    createdAt: '2024-01-10T00:00:00Z',
  },
  {
    id: 'cust-002',
    name: 'Global Tech Solutions',
    phone: '+1 (555) 300-0002',
    email: 'orders@globaltech.com',
    address: '456 Innovation Blvd, San Francisco, CA 94102',
    company: 'Global Tech Solutions',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'cust-003',
    name: 'Metro Retail Group',
    phone: '+1 (555) 300-0003',
    email: 'supply@metroretail.com',
    address: '789 Commerce St, Chicago, IL 60601',
    company: 'Metro Retail Group',
    isActive: true,
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'cust-004',
    name: 'Sunrise Healthcare',
    phone: '+1 (555) 300-0004',
    email: 'procurement@sunrisehc.com',
    address: '321 Medical Center Dr, Houston, TX 77001',
    company: 'Sunrise Healthcare Inc.',
    isActive: true,
    createdAt: '2024-02-10T00:00:00Z',
  },
  {
    id: 'cust-005',
    name: 'Pacific Distribution',
    phone: '+1 (555) 300-0005',
    email: 'orders@pacificdist.com',
    address: '555 Harbor Way, Los Angeles, CA 90012',
    company: 'Pacific Distribution LLC',
    isActive: true,
    createdAt: '2024-02-20T00:00:00Z',
  },
  {
    id: 'cust-006',
    name: 'Eastern Supplies Co.',
    phone: '+1 (555) 300-0006',
    email: 'buying@easternsupplies.com',
    address: '888 Industrial Park, Boston, MA 02101',
    company: 'Eastern Supplies Company',
    isActive: true,
    createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'cust-007',
    name: 'Mountain View Enterprises',
    phone: '+1 (555) 300-0007',
    email: 'orders@mventerprises.com',
    address: '999 Summit Rd, Denver, CO 80201',
    company: 'Mountain View Enterprises',
    isActive: false,
    createdAt: '2024-03-05T00:00:00Z',
  },
  {
    id: 'cust-008',
    name: 'Coastal Trading Co.',
    phone: '+1 (555) 300-0008',
    email: 'purchase@coastaltrading.com',
    address: '222 Seaside Blvd, Miami, FL 33101',
    company: 'Coastal Trading Company',
    isActive: true,
    createdAt: '2024-03-10T00:00:00Z',
  },
];

export const getActiveCustomers = (): Customer[] => {
  return mockCustomers.filter(customer => customer.isActive);
};

export const findCustomerById = (id: string): Customer | undefined => {
  return mockCustomers.find(customer => customer.id === id);
};
