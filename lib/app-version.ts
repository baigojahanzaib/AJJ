import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

const formatRuntimeVersion = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'policy' in value) {
    const policy = (value as { policy?: unknown }).policy;
    return typeof policy === 'string' ? policy : undefined;
  }
  return undefined;
};

export const getCurrentExpoConfig = () => {
  const manifest = Updates.manifest as {
    extra?: {
      expoClient?: typeof Constants.expoConfig;
    };
  } | null;

  return manifest?.extra?.expoClient ?? Constants.expoConfig;
};

export const getCurrentAppVersion = () => (
  getCurrentExpoConfig()?.version ?? '1.0.0'
);

export const getCurrentRuntimeVersion = () => {
  const expoConfig = getCurrentExpoConfig();
  const platformRuntimeVersion = Platform.OS === 'android'
    ? expoConfig?.android?.runtimeVersion
    : expoConfig?.ios?.runtimeVersion;

  return (
    Updates.runtimeVersion ||
    formatRuntimeVersion(platformRuntimeVersion) ||
    formatRuntimeVersion(expoConfig?.runtimeVersion) ||
    'N/A'
  );
};

export const getCurrentUpdateCreatedAt = () => (
  Updates.createdAt ? Updates.createdAt.toLocaleString() : 'N/A'
);
