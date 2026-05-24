import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { User, AuthState } from '@/types';
import {
  fetchCurrentUser,
  loginWithApi,
  logoutFromApi,
  registerWithApi,
} from '@/lib/baigo-api';

const VIEW_AS_USER_KEY = '@salesapp_view_as_user';
const AUTH_STORAGE_KEY = '@salesapp_auth_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [isViewingAsUser, setIsViewingAsUser] = useState(false);

  const persistAuthenticatedUser = useCallback(async (user: User) => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [storedUser, viewAsUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_STORAGE_KEY),
          AsyncStorage.getItem(VIEW_AS_USER_KEY),
        ]);

        if (!mounted) return;
        setIsViewingAsUser(viewAsUser === 'true');

        if (storedUser) {
          const parsed = JSON.parse(storedUser) as User;
          setState({ user: parsed, isAuthenticated: true, isLoading: false });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }

        const freshUser = await fetchCurrentUser();
        if (!mounted || !freshUser) return;
        await persistAuthenticatedUser(freshUser);
      } catch (error) {
        console.error('[Auth] Failed to load website API session:', error);
        if (mounted) setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [persistAuthenticatedUser]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      return { success: false, error: 'Please enter your email and password' };
    }

    try {
      const user = await loginWithApi(normalizedEmail, normalizedPassword);
      await persistAuthenticatedUser(user);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      return { success: false, error: message || 'Invalid email or password' };
    }
  }, [persistAuthenticatedUser]);

  const signUpClient = useCallback(async (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const user = await registerWithApi(input);
      await persistAuthenticatedUser(user);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      return { success: false, error: message || 'Unable to create account. Please try again.' };
    }
  }, [persistAuthenticatedUser]);

  const logout = useCallback(async () => {
    try {
      await logoutFromApi();
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(VIEW_AS_USER_KEY);
      setIsViewingAsUser(false);
      setState({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, []);

  const switchToUserView = useCallback(async () => {
    await AsyncStorage.setItem(VIEW_AS_USER_KEY, 'true');
    setIsViewingAsUser(true);
  }, []);

  const switchToAdminView = useCallback(async () => {
    await AsyncStorage.removeItem(VIEW_AS_USER_KEY);
    setIsViewingAsUser(false);
  }, []);

  return {
    ...state,
    login,
    signUpClient,
    logout,
    isViewingAsUser,
    switchToUserView,
    switchToAdminView,
    isAdmin: state.user?.role === 'admin' && !isViewingAsUser,
  };
});
