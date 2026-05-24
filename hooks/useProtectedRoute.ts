import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export function useProtectedRoute() {
    const { user, isAuthenticated, isLoading, isViewingAsUser } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const segmentList = segments as unknown as string[];
        const currentGroup = segmentList[0];
        const currentScreen = segmentList[1];
        const inLoginGroup = currentGroup === '(auth)';
        const inAdminGroup = currentGroup === '(admin)';
        const inSalesGroup = currentGroup === '(sales)';
        const inSharedOrderRoute = currentGroup === 'order';
        const inProtectedShopRoute =
            currentGroup === '(shop)' && (currentScreen === 'checkout' || currentScreen === 'orders');
        const inProtectedRoute = inAdminGroup || inSalesGroup || inSharedOrderRoute || inProtectedShopRoute;

        console.log('[AuthGuard] Check:', { isAuthenticated, inProtectedRoute, segments });

        const routeForRole = () => {
            if (user?.role === 'admin' && !isViewingAsUser) return '/(admin)/dashboard';
            if (user?.role === 'sales_rep' || (user?.role === 'admin' && isViewingAsUser)) return '/(sales)/catalog';
            return '/(shop)/catalog';
        };

        if (isAuthenticated) {
            if (inLoginGroup) {
                router.replace(routeForRole() as any);
                return;
            }

            if (inAdminGroup && user?.role !== 'admin') {
                router.replace(routeForRole() as any);
                return;
            }

            if (inSalesGroup && user?.role !== 'sales_rep' && user?.role !== 'admin') {
                router.replace('/(shop)/catalog' as any);
            }
        } else {
            if (inProtectedRoute) {
                console.log('[AuthGuard] Not authenticated in protected route, redirecting to login');
                router.replace('/(auth)/sign-in' as any);
            }
        }
    }, [isLoading, isAuthenticated, segments, user, isViewingAsUser]);
}
