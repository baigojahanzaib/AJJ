import { OrderStatus } from '@/types';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';
type StatusColor = 'default' | 'success' | 'warning' | 'danger' | 'info';

export const ORDER_STATUS_OPTIONS: {
  id: OrderStatus;
  label: string;
  variant: BadgeVariant;
  color: StatusColor;
}[] = [
  { id: 'quotation', label: 'Quotation', variant: 'default', color: 'default' },
  { id: 'draft', label: 'Draft', variant: 'default', color: 'default' },
  { id: 'placed', label: 'Placed', variant: 'warning', color: 'warning' },
  { id: 'confirmed', label: 'Confirmed', variant: 'info', color: 'info' },
  { id: 'awaiting_procurement', label: 'Awaiting Procurement', variant: 'info', color: 'info' },
  { id: 'processing', label: 'Processing', variant: 'info', color: 'info' },
  { id: 'ready', label: 'Ready to Fulfill', variant: 'info', color: 'info' },
  { id: 'ready_to_deliver', label: 'Ready to Deliver', variant: 'info', color: 'info' },
  { id: 'dispatched', label: 'Dispatched', variant: 'info', color: 'info' },
  { id: 'delivered', label: 'Delivered', variant: 'success', color: 'success' },
  { id: 'cancelled', label: 'Cancelled', variant: 'danger', color: 'danger' },
  { id: 'refunded', label: 'Refunded', variant: 'danger', color: 'danger' },
];

const validStatuses = new Set<OrderStatus>(ORDER_STATUS_OPTIONS.map(option => option.id));

const legacyStatusMap: Record<string, OrderStatus> = {
  pending: 'placed',
  shipped: 'dispatched',
  returned: 'refunded',
};

export const ORDER_STATUS_LABELS = ORDER_STATUS_OPTIONS.reduce((labels, option) => {
  labels[option.id] = option.label;
  return labels;
}, {} as Record<OrderStatus, string>);

export const ORDER_STATUS_CONFIG = ORDER_STATUS_OPTIONS.reduce((config, option) => {
  config[option.id] = { label: option.label, variant: option.variant, color: option.color };
  return config;
}, {} as Record<OrderStatus, { label: string; variant: BadgeVariant; color: StatusColor }>);

export const ORDER_STATUS_FILTERS: { id: OrderStatus | 'all'; label: string }[] = ([
  { id: 'all', label: 'All' },
  ...ORDER_STATUS_OPTIONS,
] as { id: OrderStatus | 'all'; label: string }[]).map(option => ({ id: option.id, label: option.label }));

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const raw = typeof value === 'string' ? value : '';
  const mapped = legacyStatusMap[raw] ?? raw;
  return validStatuses.has(mapped as OrderStatus) ? mapped as OrderStatus : 'placed';
}
