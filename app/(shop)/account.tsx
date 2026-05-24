import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ComponentType } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, ClipboardList, LogOut, Package, Shield, User } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Colors from '@/constants/colors';

export default function ShopAccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(shop)/catalog' as any);
  };

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Account</Text>
            <Text style={styles.subtitle}>Sign in to checkout and view your order history.</Text>
          </View>
          <Card style={styles.authCard}>
            <User size={40} color={Colors.light.textTertiary} />
            <Text style={styles.authTitle}>Client account</Text>
            <Text style={styles.authText}>Browse products freely. Sign in only when you are ready to order.</Text>
            <Button title="Sign In" onPress={() => router.push('/(auth)/sign-in' as any)} fullWidth />
            <Button title="Create Account" onPress={() => router.push('/(auth)/sign-up' as any)} variant="secondary" fullWidth />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const roleLabel = user.role === 'admin'
    ? 'Admin'
    : user.role === 'sales_rep'
      ? 'Sales Representative'
      : 'Client';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop</Text>
          <Card padding="none">
            <AccountRow icon={Package} label="Browse products" onPress={() => router.push('/(shop)/catalog' as any)} />
            <AccountRow icon={ClipboardList} label="My orders" onPress={() => router.push('/(shop)/orders' as any)} bordered={false} />
          </Card>
        </View>

        {user.role === 'admin' || user.role === 'sales_rep' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workspaces</Text>
            <Card padding="none">
              {user.role === 'admin' ? (
                <AccountRow icon={Shield} label="Admin console" onPress={() => router.replace('/(admin)/dashboard')} />
              ) : null}
              <AccountRow
                icon={Shield}
                label="Sales field app"
                onPress={() => router.replace('/(sales)/catalog')}
                bordered={false}
              />
            </Card>
          </View>
        ) : null}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={Colors.light.danger} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type AccountRowProps = {
  icon: ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  bordered?: boolean;
};

function AccountRow({ icon: Icon, label, onPress, bordered = true }: AccountRowProps) {
  return (
    <TouchableOpacity style={[styles.row, bordered && styles.rowBorder]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Icon size={20} color={Colors.light.textSecondary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <ChevronRight size={20} color={Colors.light.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  header: {
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  authCard: {
    alignItems: 'center',
    gap: 14,
  },
  authTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  authText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.light.primaryForeground,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 3,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.light.textSecondary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.light.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.light.dangerLight,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.danger,
  },
});
