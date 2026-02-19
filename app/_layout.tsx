import "@stardazed/streams-text-encoding";
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
import { RemoteConfigProvider } from "@/contexts/RemoteConfigContext";
import { UpdateHandler } from "@/components/UpdateHandler";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { NotificationProvider } from "@/contexts/NotificationContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ConvexProvider client={convex}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <RemoteConfigProvider>
                <UpdateHandler>
                  <NotificationProvider>
                    <OfflineProvider>
                      <DataProvider>
                        <CartProvider>
                          <RootLayoutNav />
                          <OfflineBanner />
                        </CartProvider>
                      </DataProvider>
                    </OfflineProvider>
                  </NotificationProvider>
                </UpdateHandler>
              </RemoteConfigProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </trpc.Provider>
    </ConvexProvider>
  );
}

