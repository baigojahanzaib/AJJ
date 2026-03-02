import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useConvex } from 'convex/react';
import { api } from '../convex/_generated/api';
import { User, AuthState } from '@/types';

const VIEW_AS_USER_KEY = '@salesapp_view_as_user';
const AUTH_STORAGE_KEY = '@salesapp_auth_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const convex = useConvex();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const [isViewingAsUser, setIsViewingAsUser] = useState(false);

  useEffect(() => {
    loadStoredUser();
    loadViewAsUserState();
  }, []);

  const persistAuthenticatedUser = useCallback(async (user: any) => {
    if (!user) {
      throw new Error('Invalid credentials');
    }

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
  }, []);

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
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      return { success: false, error: 'Please enter your email and password' };
    }

    try {
      console.log('[Auth] Attempting login for:', normalizedEmail);
      const user = await convex.query(api.users.validateCredentials, {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      await persistAuthenticatedUser(user);
      console.log('[Auth] Login successful for:', user.name);
      return { success: true };
    } catch (error) {
      console.error('[Auth] Login error:', error);
      const message = error instanceof Error ? error.message : String(error ?? '');
      // Check if it's a network/offline error specifically
      const isOfflineError =
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('connect') ||
        message.includes('offline') ||
        message.includes('NetworkError') ||
        message.includes('Failed to fetch');
      return {
        success: false,
        error: isOfflineError
          ? 'Unable to sign in while offline. Connect once, then continue offline.'
          : `Sign in failed: ${message || 'Please try again.'}`,
      };
    }
  }, [convex, persistAuthenticatedUser]);

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
