import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { 
  User, LogOut, Bell, Shield, HelpCircle, 
  ChevronRight, Palette, Database, FileText, Eye 
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/Card';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

export default function AdminSettings() {
  const router = useRouter();
  const { user, logout, switchToUserView } = useAuth();

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', buttons?: typeof alertConfig.buttons) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
    });
  };

  const handleSwitchToUserView = () => {
    setAlertConfig({
      visible: true,
      title: 'View as User',
      message: 'You will be switched to the sales user view. You can return to the admin panel from the user profile settings.',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch View', 
          style: 'default',
          onPress: async () => {
            await switchToUserView();
            router.replace('/(sales)/catalog');
          }
        },
      ],
    });
  };

  const handleLogout = () => {
    setAlertConfig({
      visible: true,
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          }
        },
      ],
    });
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Profile', onPress: () => showAlert('Profile', 'Profile editing coming soon') },
        { icon: Bell, label: 'Notifications', onPress: () => showAlert('Notifications', 'Notification settings coming soon') },
        { icon: Shield, label: 'Security', onPress: () => showAlert('Security', 'Security settings coming soon') },
        { icon: Eye, label: 'View as User', onPress: handleSwitchToUserView, highlight: true },
      ],
    },
    {
      title: 'App',
      items: [
        { icon: Palette, label: 'Appearance', onPress: () => showAlert('Appearance', 'Theme settings coming soon') },
        { icon: Database, label: 'Data Management', onPress: () => showAlert('Data', 'Data management coming soon') },
        { icon: FileText, label: 'Export Reports', onPress: () => showAlert('Reports', 'Report export coming soon') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', onPress: () => showAlert('Help', 'Help center coming soon') },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <Card style={styles.profileCard}>
          <Image
            source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Admin'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Administrator</Text>
            </View>
          </View>
        </Card>

        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Card padding="none">
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.settingsItem,
                    itemIndex < section.items.length - 1 && styles.settingsItemBorder,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.settingsItemLeft}>
                    <View style={[
                      styles.settingsIconContainer,
                      (item as any).highlight && styles.settingsIconHighlight
                    ]}>
                      <item.icon size={20} color={(item as any).highlight ? Colors.light.primary : Colors.light.textSecondary} />
                    </View>
                    <Text style={[
                      styles.settingsItemLabel,
                      (item as any).highlight && styles.settingsItemLabelHighlight
                    ]}>{item.label}</Text>
                  </View>
                  <ChevronRight size={20} color={Colors.light.textTertiary} />
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        ))}

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color={Colors.light.danger} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>

      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.light.primaryForeground,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsIconHighlight: {
    backgroundColor: Colors.light.primaryLight,
  },
  settingsItemLabel: {
    fontSize: 16,
    color: Colors.light.text,
  },
  settingsItemLabelHighlight: {
    color: Colors.light.primary,
    fontWeight: '600' as const,
  },
  logoutSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.light.dangerLight,
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.danger,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginBottom: 24,
  },
});
