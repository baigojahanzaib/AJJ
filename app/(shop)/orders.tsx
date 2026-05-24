import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import OrderCard from '@/components/OrderCard';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

export default function ShopOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orders: allOrders } = useData();
  const userEmail = user?.email.trim().toLowerCase() ?? '';

  const orders = useMemo(() => {
    if (!user) return [];

    return allOrders
      .filter((order) => {
        const orderEmail = order.customerEmail?.trim().toLowerCase();
        return (
          order.clientUserId === user.id ||
          order.placedByUserId === user.id ||
          (order.orderSource === 'client_shop' && !!userEmail && orderEmail === userEmail)
        );
      })
      .sort((a, b) => {
        const bTime = new Date(b.createdAt).getTime();
        const aTime = new Date(a.createdAt).getTime();
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      });
  }, [allOrders, user, userEmail]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.count}>{orders.length} order{orders.length === 1 ? '' : 's'}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.orderWrap}>
            <OrderCard order={item} onPress={() => router.push(`/order/${item.id}`)} />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ClipboardList size={64} color={Colors.light.textTertiary} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptySubtitle}>Your submitted client orders will appear here.</Text>
            <Button title="Browse Products" onPress={() => router.push('/(shop)/catalog' as any)} style={styles.emptyButton} />
          </View>
        }
        showsVerticalScrollIndicator={false}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  count: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  orderWrap: {
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 18,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    marginTop: 24,
  },
});
