import { User } from '@/types';

export const mockUsers: User[] = [
  {
    id: 'admin-001',
    email: 'admin@company.com',
    password: 'admin123',
    name: 'John Administrator',
    role: 'admin',
    phone: '+1 (555) 100-0001',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'sales-001',
    email: 'sarah@company.com',
    password: 'sales123',
    name: 'Sarah Mitchell',
    role: 'sales_rep',
    phone: '+1 (555) 200-0001',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    isActive: true,
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'sales-002',
    email: 'michael@company.com',
    password: 'sales123',
    name: 'Michael Chen',
    role: 'sales_rep',
    phone: '+1 (555) 200-0002',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    isActive: true,
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'sales-003',
    email: 'emily@company.com',
    password: 'sales123',
    name: 'Emily Rodriguez',
    role: 'sales_rep',
    phone: '+1 (555) 200-0003',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    isActive: true,
    createdAt: '2024-02-15T00:00:00Z',
  },
  {
    id: 'sales-004',
    email: 'david@company.com',
    password: 'sales123',
    name: 'David Thompson',
    role: 'sales_rep',
    phone: '+1 (555) 200-0004',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    isActive: false,
    createdAt: '2024-03-01T00:00:00Z',
  },
];

export const findUserByEmail = (email: string): User | undefined => {
  return mockUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
};

export const validateCredentials = (email: string, password: string): User | null => {
  const user = findUserByEmail(email);
  if (user && user.password === password && user.isActive) {
    return user;
  }
  return null;
};
