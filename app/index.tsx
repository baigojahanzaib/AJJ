import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, ShoppingBag } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading: authLoading, isAuthenticated, user, isViewingAsUser } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Handle navigation in useEffect to avoid updating state during render
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role === 'admin' && !isViewingAsUser) {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(sales)/catalog');
      }
    }
  }, [authLoading, isAuthenticated, user, isViewingAsUser, router]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ShoppingBag size={48} color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show loading while redirecting authenticated users
  if (isAuthenticated && user) {
    return (
      <View style={styles.loadingContainer}>
        <ShoppingBag size={48} color={Colors.light.primary} />
        <Text style={styles.loadingText}>Redirecting...</Text>
      </View>
    );
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await login(email.trim(), password);
      
      if (result.success) {
        console.log('[Login] Success, navigating...');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <ShoppingBag size={40} color={Colors.light.primary} />
            </View>
            <Text style={styles.title}>SalesFlow</Text>
            <Text style={styles.subtitle}>Sales Representative Portal</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Mail size={20} color={Colors.light.textTertiary} />}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              leftIcon={<Lock size={20} color={Colors.light.textTertiary} />}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.loginButton}
            />
          </View>

          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Demo Accounts</Text>
            <TouchableOpacity
              style={styles.demoAccount}
              onPress={() => {
                setEmail('admin@company.com');
                setPassword('admin123');
              }}
            >
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>Admin</Text>
              </View>
              <Text style={styles.demoEmail}>admin@company.com</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoAccount}
              onPress={() => {
                setEmail('sarah@company.com');
                setPassword('sales123');
              }}
            >
              <View style={[styles.demoBadge, styles.salesBadge]}>
                <Text style={styles.demoBadgeText}>Sales</Text>
              </View>
              <Text style={styles.demoEmail}>sarah@company.com</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  form: {
    marginBottom: 32,
  },
  error: {
    color: Colors.light.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
  },
  demoSection: {
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  demoBadge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  salesBadge: {
    backgroundColor: Colors.light.accent,
  },
  demoBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primaryForeground,
  },
  demoEmail: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
});
