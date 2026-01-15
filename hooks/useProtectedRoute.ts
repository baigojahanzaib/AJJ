import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export function useProtectedRoute() {
    const { user, isAuthenticated, isLoading, isViewingAsUser } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(admin)' || segments[0] === '(sales)';
        const inPublicGroup = segments.length === 0 || segments[0] === 'index'; // Adjust based on your public routes

        console.log('[AuthGuard] Check:', { isAuthenticated, inAuthGroup, segments });

        if (isAuthenticated) {
            if (inPublicGroup) {
                // If logged in and on login screen, redirect to appropriate dashboard
                // Note: index.tsx also handles this, but having it here handles deep links to / too
                if (user?.role === 'admin' && !isViewingAsUser) {
                    router.replace('/(admin)/dashboard');
                } else {
                    router.replace('/(sales)/catalog');
                }
            }
        } else {
            // Not authenticated
            if (inAuthGroup) {
                // Redirect to login if trying to access protected routes
                console.log('[AuthGuard] Not authenticated in protected route, redirecting to login');
                router.replace('/');
            }
        }
    }, [isLoading, isAuthenticated, segments, user, isViewingAsUser]);
}
