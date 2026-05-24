import { Tabs } from 'expo-router';
import { Package, ShoppingCart, ClipboardList, User } from 'lucide-react-native';
import { Text, View, StyleSheet, Platform, ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import Colors from '@/constants/colors';

function CartIcon({ color, size }: { color: ColorValue; size: number }) {
  const { itemCount } = useCart();

  return (
    <View>
      <ShoppingCart size={size} color={color as string} />
      {itemCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 9 ? '9+' : itemCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ShopLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'android' ? 56 + Math.max(insets.bottom, 0) : undefined;
  const tabBarPaddingBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 0) : undefined;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors.light.surface,
          borderTopColor: Colors.light.borderLight,
          ...(Platform.OS === 'android' ? {
            height: tabBarHeight,
            paddingBottom: tabBarPaddingBottom,
            paddingTop: 5,
          } : {}),
        },
      }}
    >
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color, size }) => <Package size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <CartIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <User size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="product/[id]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: Colors.light.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.light.primaryForeground,
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
