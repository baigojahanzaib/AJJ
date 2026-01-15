import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Package, Users, ClipboardList, DollarSign, Clock } from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/Card';
import Colors from '@/constants/colors';

export default function AdminDashboard() {
  const { dashboardStats, orders } = useData();
  const { user } = useAuth();

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const recentOrders = orders.slice(0, 5);

  const stats = [
    {
      title: 'Total Revenue',
      value: formatCurrency(dashboardStats.totalRevenue),
      icon: DollarSign,
      color: Colors.light.success,
      bgColor: Colors.light.successLight,
    },
    {
      title: 'Total Orders',
      value: dashboardStats.totalOrders.toString(),
      icon: ClipboardList,
      color: Colors.light.info,
      bgColor: Colors.light.infoLight,
    },
    {
      title: 'Products',
      value: dashboardStats.totalProducts.toString(),
      icon: Package,
      color: Colors.light.warning,
      bgColor: Colors.light.warningLight,
    },
    {
      title: 'Sales Reps',
      value: dashboardStats.totalUsers.toString(),
      icon: Users,
      color: Colors.light.primary,
      bgColor: Colors.light.surfaceSecondary,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'Admin'}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Admin</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <Card key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stat.bgColor }]}>
                <stat.icon size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statTitle}>{stat.title}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Month</Text>
            <TrendingUp size={20} color={Colors.light.success} />
          </View>
          <Card>
            <View style={styles.monthlyStats}>
              <View style={styles.monthlyStat}>
                <Text style={styles.monthlyValue}>{dashboardStats.ordersThisMonth}</Text>
                <Text style={styles.monthlyLabel}>Orders</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.monthlyStat}>
                <Text style={styles.monthlyValue}>{formatCurrency(dashboardStats.revenueThisMonth)}</Text>
                <Text style={styles.monthlyLabel}>Revenue</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.monthlyStat}>
                <Text style={[styles.monthlyValue, { color: Colors.light.warning }]}>
                  {dashboardStats.pendingOrders}
                </Text>
                <Text style={styles.monthlyLabel}>Pending</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <Clock size={18} color={Colors.light.textTertiary} />
          </View>
          {recentOrders.map((order) => (
            <Card key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                <View style={[styles.statusBadge, getStatusStyle(order.status)]}>
                  <Text style={[styles.statusText, getStatusTextStyle(order.status)]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderCustomer}>{order.customerName}</Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderRep}>{order.salesRepName}</Text>
                <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'delivered':
      return { backgroundColor: Colors.light.successLight };
    case 'cancelled':
      return { backgroundColor: Colors.light.dangerLight };
    case 'pending':
      return { backgroundColor: Colors.light.warningLight };
    default:
      return { backgroundColor: Colors.light.infoLight };
  }
};

const getStatusTextStyle = (status: string) => {
  switch (status) {
    case 'delivered':
      return { color: Colors.light.successForeground };
    case 'cancelled':
      return { color: Colors.light.dangerForeground };
    case 'pending':
      return { color: Colors.light.warningForeground };
    default:
      return { color: Colors.light.infoForeground };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.light.primaryForeground,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 16,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  monthlyStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  monthlyValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  monthlyLabel: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.light.border,
  },
  orderCard: {
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  orderCustomer: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  orderRep: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
});
