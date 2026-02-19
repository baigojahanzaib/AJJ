import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from './AuthContext';

// Types for remote configuration
export interface FeatureFlags {
    enableOfflineMode: boolean;
    enableNotifications: boolean;
    enableProductSearch: boolean;
    enableOrderEditing: boolean;
    [key: string]: boolean;
}

export interface MaintenanceStatus {
    enabled: boolean;
    message: string;
    allowedUserIds: string[];
}

export interface UpdateSettings {
    forceUpdate: boolean;
    minVersion: string;
    updateMessage: string;
}

export interface TaxSettings {
    enabled: boolean;
    rate: number;
    allowPerOrderSelection: boolean;
}

export interface AppAnnouncement {
    enabled: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success';
    dismissible: boolean;
}

interface RemoteConfigContextType {
    // Feature flags
    featureFlags: FeatureFlags;
    isFeatureEnabled: (feature: string) => boolean;

    // Maintenance mode
    maintenanceStatus: MaintenanceStatus;
    isInMaintenance: boolean;

    // Update settings
    updateSettings: UpdateSettings;

    // Tax settings
    taxSettings: TaxSettings;

    // Announcements
    announcement: AppAnnouncement | null;

    // Loading state
    isLoading: boolean;

    // Admin functions
    setFeatureFlag: (flag: string, enabled: boolean) => Promise<void>;
    setMaintenanceMode: (enabled: boolean, message?: string) => Promise<void>;
    setAnnouncement: (announcement: Partial<AppAnnouncement>) => Promise<void>;
    setTaxSettings: (settings: Partial<TaxSettings>) => Promise<void>;
}

const defaultFeatureFlags: FeatureFlags = {
    enableOfflineMode: true,
    enableNotifications: true,
    enableProductSearch: true,
    enableOrderEditing: true,
};

const defaultMaintenanceStatus: MaintenanceStatus = {
    enabled: false,
    message: '',
    allowedUserIds: [],
};

const defaultUpdateSettings: UpdateSettings = {
    forceUpdate: false,
    minVersion: '1.0.0',
    updateMessage: 'A new version is available!',
};

const defaultTaxSettings: TaxSettings = {
    enabled: true,
    rate: 0.15,
    allowPerOrderSelection: true,
};

const RemoteConfigContext = createContext<RemoteConfigContextType | undefined>(undefined);

interface RemoteConfigProviderProps {
    children: ReactNode;
    userId?: string;
}

export function RemoteConfigProvider({ children, userId }: RemoteConfigProviderProps) {
    // Query remote configs from Convex
    const featureFlagsData = useQuery(api.appConfig.getFeatureFlags);
    const maintenanceData = useQuery(api.appConfig.getMaintenanceStatus);
    const updateSettingsData = useQuery(api.appConfig.getUpdateSettings);
    const taxSettingsData = useQuery(api.appConfig.getConfig, { key: 'tax_settings' });
    const announcementData = useQuery(api.appConfig.getConfig, { key: 'app_announcement' });

    // Get auth state to check for admin role.
    // Keep this defensive so a provider-order mistake doesn't crash startup.
    const auth = useAuth();
    const user = auth?.user;

    // Mutations
    const setConfigMutation = useMutation(api.appConfig.setConfig);

    // Parse feature flags
    const featureFlags: FeatureFlags = {
        ...defaultFeatureFlags,
        ...(featureFlagsData || {}),
    };

    // Parse maintenance status
    const maintenanceStatus: MaintenanceStatus = {
        ...defaultMaintenanceStatus,
        ...(maintenanceData || {}),
    };

    // Check if user is allowed during maintenance
    const isUserAllowed = userId && maintenanceStatus.allowedUserIds?.includes(userId);
    const isAdmin = user?.role === 'admin';
    const isInMaintenance = maintenanceStatus.enabled && !isUserAllowed && !isAdmin;

    // Parse update settings
    const updateSettings: UpdateSettings = {
        ...defaultUpdateSettings,
        ...(updateSettingsData || {}),
    };

    // Parse tax settings
    const taxSettings: TaxSettings = {
        ...defaultTaxSettings,
        ...(taxSettingsData || {}),
    };

    // Parse announcement
    const announcement: AppAnnouncement | null = announcementData?.enabled
        ? announcementData as AppAnnouncement
        : null;

    // Loading state
    const isLoading = featureFlagsData === undefined ||
        maintenanceData === undefined ||
        updateSettingsData === undefined ||
        taxSettingsData === undefined;

    // Helper functions
    const isFeatureEnabled = (feature: string): boolean => {
        return featureFlags[feature] ?? true;
    };

    // Admin mutation functions
    const setFeatureFlag = async (flag: string, enabled: boolean) => {
        const newFlags = { ...featureFlags, [flag]: enabled };
        await setConfigMutation({
            key: 'feature_flags',
            value: newFlags,
            updatedBy: userId,
        });
    };

    const setMaintenanceMode = async (enabled: boolean, message?: string) => {
        await setConfigMutation({
            key: 'maintenance_mode',
            value: {
                ...maintenanceStatus,
                enabled,
                message: message ?? maintenanceStatus.message,
            },
            updatedBy: userId,
        });
    };

    const setAnnouncement = async (newAnnouncement: Partial<AppAnnouncement>) => {
        const current = announcementData || {
            enabled: false,
            title: '',
            message: '',
            type: 'info',
            dismissible: true,
        };
        await setConfigMutation({
            key: 'app_announcement',
            value: { ...current, ...newAnnouncement },
            updatedBy: userId,
        });
    };

    const setTaxSettings = async (newSettings: Partial<TaxSettings>) => {
        await setConfigMutation({
            key: 'tax_settings',
            value: { ...taxSettings, ...newSettings },
            updatedBy: userId,
        });
    };

    const value: RemoteConfigContextType = {
        featureFlags,
        isFeatureEnabled,
        maintenanceStatus,
        isInMaintenance,
        updateSettings,
        taxSettings,
        announcement,
        isLoading,
        setFeatureFlag,
        setMaintenanceMode,
        setAnnouncement,
        setTaxSettings,
    };

    return (
        <RemoteConfigContext.Provider value={value}>
            {children}
        </RemoteConfigContext.Provider>
    );
}

export function useRemoteConfig() {
    const context = useContext(RemoteConfigContext);
    if (context === undefined) {
        throw new Error('useRemoteConfig must be used within a RemoteConfigProvider');
    }
    return context;
}

// Convenience hooks
export function useFeatureFlag(flag: string): boolean {
    const { isFeatureEnabled } = useRemoteConfig();
    return isFeatureEnabled(flag);
}

export function useMaintenanceMode() {
    const { isInMaintenance, maintenanceStatus } = useRemoteConfig();
    return { isInMaintenance, ...maintenanceStatus };
}

export function useAnnouncement() {
    const { announcement } = useRemoteConfig();
    return announcement;
}
