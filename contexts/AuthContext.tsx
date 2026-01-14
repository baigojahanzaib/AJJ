import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { User, AuthState } from '@/types';
import { validateCredentials } from '@/mocks/users';

const VIEW_AS_USER_KEY = '@salesapp_view_as_user';
const AUTH_STORAGE_KEY = '@salesapp_auth_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
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
      
      const user = validateCredentials(email, password);
      
      if (!user) {
        console.log('[Auth] Invalid credentials');
        return { success: false, error: 'Invalid email or password' };
      }

      if (!user.isActive) {
        console.log('[Auth] User account is inactive');
        return { success: false, error: 'Your account has been deactivated' };
      }

      console.log('[Auth] Login successful for:', user.name);
      
      const userWithoutPassword = { ...user, password: '' };
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithoutPassword));
      
      setState({
        user: userWithoutPassword,
        isAuthenticated: true,
        isLoading: false,
      });

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
