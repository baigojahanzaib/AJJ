import { Tabs } from "expo-router";
import { LayoutDashboard, Package, Users, ClipboardList, Settings } from "lucide-react-native";
import Colors from "@/constants/colors";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminTabLayout() {
  const insets = useSafeAreaInsets();
  // Calculate tab bar height: base height + bottom safe area for Android nav bar
  const tabBarHeight = Platform.OS === 'android'
    ? 56 + Math.max(insets.bottom, 0) // 56 is standard tab bar height
    : undefined; // Let iOS handle it automatically
  const tabBarPaddingBottom = Platform.OS === 'android'
    ? Math.max(insets.bottom, 0)
    : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
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
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
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
        name="users"
        options={{
          title: "Users",
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-product"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="ecwid-sync"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="export-reports"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="remote-config"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
