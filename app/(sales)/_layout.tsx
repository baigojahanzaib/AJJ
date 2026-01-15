import { Tabs, Stack } from "expo-router";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { Package, ShoppingCart, ClipboardList, User, Users } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { View, Text, StyleSheet } from "react-native";

function CartTabIcon({ color, size }: { color: string; size: number }) {
  const { itemCount } = useCart();

  return (
    <View>
      <ShoppingCart size={size} color={color} />
      {itemCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{itemCount > 9 ? '9+' : itemCount}</Text>
        </View>
      )}
    </View>
  );
}

function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.light.surface,
          borderTopColor: Colors.light.borderLight,
        },
      }}
    >
      <Tabs.Screen
        name="catalog"
        options={({ route }) => {
          const routeName = getFocusedRouteNameFromRoute(route);
          return {
            title: "Catalog",
            tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
            tabBarStyle: ((routeName) => {
              if (routeName === "[id]") {
                return { display: "none" };
              }
              return {
                backgroundColor: Colors.light.surface,
                borderTopColor: Colors.light.borderLight,
              };
            })(routeName),
          };
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => <CartTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* Hide these from tab bar - they're accessed via navigation */}

      <Tabs.Screen
        name="customer/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="customer/add"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function SalesLayout() {
  return <TabsLayout />;
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

