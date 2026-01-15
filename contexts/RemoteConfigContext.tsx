import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';

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

    // Announcements
    announcement: AppAnnouncement | null;

    // Loading state
    isLoading: boolean;

    // Admin functions
    setFeatureFlag: (flag: string, enabled: boolean) => Promise<void>;
    setMaintenanceMode: (enabled: boolean, message?: string) => Promise<void>;
    setAnnouncement: (announcement: Partial<AppAnnouncement>) => Promise<void>;
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
    const announcementData = useQuery(api.appConfig.getConfig, { key: 'app_announcement' });

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
    const isInMaintenance = maintenanceStatus.enabled && !isUserAllowed;

    // Parse update settings
    const updateSettings: UpdateSettings = {
        ...defaultUpdateSettings,
        ...(updateSettingsData || {}),
    };

    // Parse announcement
    const announcement: AppAnnouncement | null = announcementData?.enabled
        ? announcementData as AppAnnouncement
        : null;

    // Loading state
    const isLoading = featureFlagsData === undefined ||
        maintenanceData === undefined ||
        updateSettingsData === undefined;

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

    const value: RemoteConfigContextType = {
        featureFlags,
        isFeatureEnabled,
        maintenanceStatus,
        isInMaintenance,
        updateSettings,
        announcement,
        isLoading,
        setFeatureFlag,
        setMaintenanceMode,
        setAnnouncement,
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
