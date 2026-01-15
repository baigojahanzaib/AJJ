import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { User, AuthState } from '@/types';

const VIEW_AS_USER_KEY = '@salesapp_view_as_user';
const AUTH_STORAGE_KEY = '@salesapp_auth_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const [isViewingAsUser, setIsViewingAsUser] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ email: string; password: string } | null>(null);

  // Query Convex for user validation when credentials are set
  const convexUser = useQuery(
    api.users.validateCredentials,
    loginCredentials ? { email: loginCredentials.email, password: loginCredentials.password } : "skip"
  );

  useEffect(() => {
    loadStoredUser();
    loadViewAsUserState();
  }, []);

  // Handle Convex query result for login
  useEffect(() => {
    if (loginCredentials && convexUser !== undefined) {
      handleConvexLoginResult(convexUser);
      setLoginCredentials(null);
    }
  }, [convexUser, loginCredentials]);

  const handleConvexLoginResult = async (user: any) => {
    if (!user) {
      console.log('[Auth] Invalid credentials from Convex');
      return;
    }

    console.log('[Auth] Login successful for:', user.name);

    // Map Convex user to our User type
    const mappedUser: User = {
      id: user._id,
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };

    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mappedUser));

    setState({
      user: mappedUser,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const loadViewAsUserState = async () => {
    try {
      const viewAsUser = await AsyncStorage.getItem(VIEW_AS_USER_KEY);
      if (viewAsUser === 'true') {
        setIsViewingAsUser(true);
      }
    } catch (error) {
      console.error('[Auth] Error loading view as user state:', error);
    }
  };

  const loadStoredUser = async () => {
    try {
      console.log('[Auth] Loading stored user...');
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        const user = JSON.parse(storedUser) as User;
        console.log('[Auth] Found stored user:', user.email);
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        console.log('[Auth] No stored user found');
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[Auth] Error loading stored user:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[Auth] Attempting login for:', email);

      // Set credentials to trigger Convex query
      setLoginCredentials({ email, password });

      // For immediate feedback, we'll return success and let the useEffect handle the actual login
      // This is a workaround since we can't await the Convex query directly in a callback
      return { success: true };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('[Auth] Logging out...');
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(VIEW_AS_USER_KEY);
      setIsViewingAsUser(false);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, []);

  const switchToUserView = useCallback(async () => {
    try {
      console.log('[Auth] Switching to user view...');
      await AsyncStorage.setItem(VIEW_AS_USER_KEY, 'true');
      setIsViewingAsUser(true);
    } catch (error) {
      console.error('[Auth] Error switching to user view:', error);
    }
  }, []);

  const switchToAdminView = useCallback(async () => {
    try {
      console.log('[Auth] Switching back to admin view...');
      await AsyncStorage.removeItem(VIEW_AS_USER_KEY);
      setIsViewingAsUser(false);
    } catch (error) {
      console.error('[Auth] Error switching to admin view:', error);
    }
  }, []);

  return {
    ...state,
    login,
    logout,
    isViewingAsUser,
    switchToUserView,
    switchToAdminView,
    isAdmin: state.user?.role === 'admin' && !isViewingAsUser,
  };
});
