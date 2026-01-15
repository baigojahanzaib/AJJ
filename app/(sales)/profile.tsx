
import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  LogOut, Bell, HelpCircle, ChevronRight,
  TrendingUp, Package, DollarSign, ClipboardList, Shield
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import Card from '@/components/Card';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

export default function SalesProfile() {
  const router = useRouter();
  const { user, logout, isViewingAsUser, switchToAdminView } = useAuth();
  const { getOrdersBySalesRep } = useData();

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  const myOrders = useMemo(() => {
    return getOrdersBySalesRep(user?.id || '');
  }, [user?.id, getOrdersBySalesRep]);

  const stats = useMemo(() => {
    const totalSales = myOrders.reduce((sum, order) => sum + order.total, 0);
    const deliveredOrders = myOrders.filter(o => o.status === 'delivered').length;
    const pendingOrders = myOrders.filter(o => o.status === 'pending').length;

    return {
      totalOrders: myOrders.length,
      totalSales,
      deliveredOrders,
      pendingOrders,
    };
  }, [myOrders]);

  const handleSwitchToAdmin = () => {
    setAlertConfig({
      visible: true,
      title: 'Return to Admin Panel',
      message: 'Switch back to the admin view?',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          style: 'default',
          onPress: async () => {
            await switchToAdminView();
            router.replace('/(admin)/dashboard');
          }
        },
      ],
    });
  };

  const handleLogout = () => {
    setAlertConfig({
      visible: true,
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          }
        },
      ],
    });
  };

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const performanceStats = [
    {
      title: 'Total Orders',
      value: stats.totalOrders.toString(),
      icon: ClipboardList,
      color: Colors.light.info,
      bgColor: Colors.light.infoLight,
    },
    {
      title: 'Total Sales',
      value: formatCurrency(stats.totalSales),
      icon: DollarSign,
      color: Colors.light.success,
      bgColor: Colors.light.successLight,
    },
    {
      title: 'Delivered',
      value: stats.deliveredOrders.toString(),
      icon: Package,
      color: Colors.light.success,
      bgColor: Colors.light.successLight,
    },
    {
      title: 'Pending',
      value: stats.pendingOrders.toString(),
      icon: TrendingUp,
      color: Colors.light.warning,
      bgColor: Colors.light.warningLight,
    },
  ];

  const showComingSoon = (title: string) => {
    setAlertConfig({
      visible: true,
      title,
      message: 'Coming soon',
      type: 'info',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  };

  const settingsItems = [
    { icon: Bell, label: 'Notifications', onPress: () => showComingSoon('Notifications') },
    { icon: HelpCircle, label: 'Help Center', onPress: () => showComingSoon('Help Center') },
    ...(isViewingAsUser && user?.role === 'admin' ? [
      { icon: Shield, label: 'Return to Admin Panel', onPress: handleSwitchToAdmin, highlight: true },
    ] : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <Card style={styles.profileCard}>
          <Image
            source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face' }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Sales Rep'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            <View style={[styles.roleBadge, isViewingAsUser && styles.adminViewingBadge]}>
              <Text style={styles.roleText}>
                {isViewingAsUser ? 'Admin (Viewing as User)' : 'Sales Representative'}
              </Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            {performanceStats.map((stat, index) => (
              <Card key={index} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: stat.bgColor }]}>
                  <stat.icon size={18} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statTitle}>{stat.title}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <Card padding="none">
            {settingsItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.settingsItem,
                  index < settingsItems.length - 1 && styles.settingsItemBorder,
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.settingsItemLeft}>
                  <View style={[
                    styles.settingsIconContainer,
                    (item as any).highlight && styles.settingsIconHighlight
                  ]}>
                    <item.icon size={20} color={(item as any).highlight ? Colors.light.primary : Colors.light.textSecondary} />
                  </View>
                  <Text style={[
                    styles.settingsItemLabel,
                    (item as any).highlight && styles.settingsItemLabelHighlight
                  ]}>{item.label}</Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            ))}
          </Card>
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color={Colors.light.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginBottom: 10,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  adminViewingBadge: {
    backgroundColor: Colors.light.primary,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.accentForeground,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 14,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsIconHighlight: {
    backgroundColor: Colors.light.primaryLight,
  },
  settingsItemLabel: {
    fontSize: 16,
    color: Colors.light.text,
  },
  settingsItemLabelHighlight: {
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  logoutSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.dangerLight,
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.danger,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginBottom: 24,
  },
});
