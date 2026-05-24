import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function IndexRoute() {
  const { user, isAuthenticated, isLoading, isViewingAsUser } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  if (isAuthenticated && user?.role === 'admin' && !isViewingAsUser) {
    return <Redirect href={'/(admin)/dashboard' as any} />;
  }

  if (isAuthenticated && (user?.role === 'sales_rep' || user?.role === 'admin')) {
    return <Redirect href={'/(sales)/catalog' as any} />;
  }

  return <Redirect href={'/(shop)/catalog' as any} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
});
