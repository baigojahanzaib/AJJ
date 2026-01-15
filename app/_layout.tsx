import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { trpc, trpcClient } from "@/lib/trpc";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { CartProvider } from "@/contexts/CartContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { OfflineBanner } from "@/components/OfflineBanner";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

import { useProtectedRoute } from "@/hooks/useProtectedRoute";

function RootLayoutNav() {
  useProtectedRoute();

  return (
    <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(sales)" />
      <Stack.Screen name="order/[id]" />
    </Stack>
  );
}

import { NotificationProvider } from "@/contexts/NotificationContext";

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ConvexProvider client={convex}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <NotificationProvider>
              <AuthProvider>
                <OfflineProvider>
                  <DataProvider>
                    <CartProvider>
                      <RootLayoutNav />
                      <OfflineBanner />
                    </CartProvider>
                  </DataProvider>
                </OfflineProvider>
              </AuthProvider>
            </NotificationProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </trpc.Provider>
    </ConvexProvider>
  );
}

