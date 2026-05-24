import { StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import Colors from '@/constants/colors';

export function SyncProgressBanner() {
  const { syncProgress } = useData();

  if (!syncProgress.active || syncProgress.total <= 0) return null;

  const progress = Math.max(0.05, Math.min(1, syncProgress.completed / syncProgress.total));
  const percent = Math.round(progress * 100);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.row}>
        <RefreshCw size={18} color={Colors.light.primary} />
        <View style={styles.copy}>
          <Text style={styles.title}>{syncProgress.label}</Text>
          <Text style={styles.subtitle}>
            {syncProgress.mode === 'delta' ? 'Only changed records are being pulled' : 'Full website data sync'} - {percent}%
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 96,
    zIndex: 60,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.surfaceSecondary,
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },
});
