import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Percent } from 'lucide-react-native';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import Colors from '@/constants/colors';
import Card from '@/components/Card';

export default function TaxSettingsScreen() {
  const router = useRouter();
  const { taxSettings, isLoading, setTaxSettings } = useRemoteConfig();
  const [rateInput, setRateInput] = useState('');
  const [isSavingRate, setIsSavingRate] = useState(false);

  useEffect(() => {
    const percentage = (taxSettings.rate * 100).toFixed(2).replace(/\.?0+$/, '');
    setRateInput(percentage);
  }, [taxSettings.rate]);

  const currentRateLabel = useMemo(() => {
    return `${(taxSettings.rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  }, [taxSettings.rate]);

  const handleToggleTaxEnabled = async (enabled: boolean) => {
    try {
      await setTaxSettings({ enabled });
    } catch {
      Alert.alert('Error', 'Failed to update tax setting');
    }
  };

  const handleTogglePerOrderSelection = async (enabled: boolean) => {
    try {
      await setTaxSettings({ allowPerOrderSelection: enabled });
    } catch {
      Alert.alert('Error', 'Failed to update per-order tax setting');
    }
  };

  const handleSaveTaxRate = async () => {
    const normalized = rateInput.replace(',', '.').trim();
    const parsed = parseFloat(normalized);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      Alert.alert('Invalid Tax Rate', 'Enter a value between 0 and 100.');
      return;
    }

    try {
      setIsSavingRate(true);
      await setTaxSettings({ rate: parsed / 100 });
      Alert.alert('Success', 'Tax rate updated.');
    } catch {
      Alert.alert('Error', 'Failed to save tax rate.');
    } finally {
      setIsSavingRate(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading tax settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tax Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Percent size={20} color={Colors.light.primary} />
            <Text style={styles.sectionTitle}>Order Tax Rules</Text>
          </View>
          <Card>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Enable Taxes</Text>
                <Text style={styles.toggleDescription}>
                  Turn tax calculation on or off across the app
                </Text>
              </View>
              <Switch
                value={taxSettings.enabled}
                onValueChange={handleToggleTaxEnabled}
                trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Allow Per-Order Tax Selection</Text>
                <Text style={styles.toggleDescription}>
                  Let users turn tax on/off on each individual order
                </Text>
              </View>
              <Switch
                value={taxSettings.allowPerOrderSelection}
                onValueChange={handleTogglePerOrderSelection}
                disabled={!taxSettings.enabled}
                trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.inputLabel}>Tax Rate (%)</Text>
            <View style={styles.rateInputRow}>
              <TextInput
                style={styles.rateInput}
                value={rateInput}
                onChangeText={setRateInput}
                keyboardType="decimal-pad"
                placeholder="15"
                placeholderTextColor={Colors.light.inputPlaceholder}
              />
              <Text style={styles.percentLabel}>%</Text>
            </View>

            <Text style={styles.currentRateText}>Current: {currentRateLabel}</Text>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveTaxRate}
              disabled={isSavingRate}
            >
              <Text style={styles.saveButtonText}>
                {isSavingRate ? 'Saving...' : 'Save Tax Rate'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  },
  loadingText: {
    marginTop: 16,
    color: Colors.light.textTertiary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.light.text,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 16,
    marginBottom: 8,
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.inputBackground,
    borderWidth: 1,
    borderColor: Colors.light.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  rateInput: {
    flex: 1,
    color: Colors.light.text,
    fontSize: 15,
    paddingVertical: 12,
  },
  percentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  currentRateText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: Colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
});
