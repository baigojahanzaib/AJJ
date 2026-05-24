import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { fetchAppConfig, updateAppConfig } from '@/lib/baigo-api';
import { useAuth } from './AuthContext';

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
    featureFlags: FeatureFlags;
    isFeatureEnabled: (feature: string) => boolean;
    maintenanceStatus: MaintenanceStatus;
    isInMaintenance: boolean;
    updateSettings: UpdateSettings;
    taxSettings: TaxSettings;
    announcement: AppAnnouncement | null;
    isLoading: boolean;
    setFeatureFlag: (flag: string, enabled: boolean) => Promise<void>;
    setMaintenanceMode: (enabled: boolean, message?: string) => Promise<void>;
    setAnnouncement: (announcement: Partial<AppAnnouncement>) => Promise<void>;
    setTaxSettings: (settings: Partial<TaxSettings>) => Promise<void>;
    setUpdateSettings: (settings: Partial<UpdateSettings>) => Promise<void>;
    reloadConfig: () => Promise<void>;
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

function normalizeMaintenance(value: unknown): MaintenanceStatus {
    if (typeof value === 'boolean') {
        return { ...defaultMaintenanceStatus, enabled: value };
    }
    if (!value || typeof value !== 'object') return defaultMaintenanceStatus;
    const raw = value as Record<string, unknown>;
    return {
        enabled: Boolean(raw.enabled),
        message: String(raw.message ?? ''),
        allowedUserIds: Array.isArray(raw.allowedUserIds)
            ? raw.allowedUserIds.map(String)
            : Array.isArray(raw.allowed_user_ids)
                ? raw.allowed_user_ids.map(String)
                : [],
    };
}

function normalizeAnnouncement(value: unknown): AppAnnouncement | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    if (!raw.enabled) return null;
    const type = raw.type === 'warning' || raw.type === 'success' ? raw.type : 'info';
    return {
        enabled: true,
        title: String(raw.title ?? ''),
        message: String(raw.message ?? ''),
        type,
        dismissible: raw.dismissible !== false,
    };
}

function normalizeTaxSettings(value: unknown): TaxSettings {
    if (!value || typeof value !== 'object') return defaultTaxSettings;
    const raw = value as Record<string, unknown>;
    const displayMode = String(raw.display_mode ?? raw.displayMode ?? 'inclusive');
    const percentRate = Number(raw.rate ?? 15);
    return {
        enabled: displayMode === 'exclusive',
        rate: Number.isFinite(percentRate) ? percentRate / 100 : defaultTaxSettings.rate,
        allowPerOrderSelection: true,
    };
}

export function RemoteConfigProvider({ children, userId }: RemoteConfigProviderProps) {
    const auth = useAuth();
    const user = auth?.user;
    const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(defaultFeatureFlags);
    const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus>(defaultMaintenanceStatus);
    const [updateSettings, setUpdateSettingsState] = useState<UpdateSettings>(defaultUpdateSettings);
    const [taxSettings, setTaxSettingsState] = useState<TaxSettings>(defaultTaxSettings);
    const [announcement, setAnnouncementState] = useState<AppAnnouncement | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const applyConfig = useCallback((data: any) => {
        setFeatureFlags({ ...defaultFeatureFlags, ...(data?.features ?? {}) });
        setMaintenanceStatus(normalizeMaintenance(data?.maintenance_detail ?? data?.maintenance));
        setAnnouncementState(normalizeAnnouncement(data?.announcement));
        setTaxSettingsState(normalizeTaxSettings(data?.vat));
        setUpdateSettingsState({
            forceUpdate: Boolean(data?.force_update ?? data?.forceUpdate),
            minVersion: String(data?.min_supported_version ?? data?.minVersion ?? defaultUpdateSettings.minVersion),
            updateMessage: String(data?.update_message ?? data?.updateMessage ?? defaultUpdateSettings.updateMessage),
        });
    }, []);

    const reloadConfig = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchAppConfig();
            applyConfig(data);
        } catch (error) {
            console.warn('[RemoteConfig] Falling back to local defaults:', error);
        } finally {
            setIsLoading(false);
        }
    }, [applyConfig]);

    useEffect(() => {
        reloadConfig();
    }, [reloadConfig, user?.id]);

    const isUserAllowed = userId && maintenanceStatus.allowedUserIds?.includes(userId);
    const isAdmin = user?.role === 'admin';
    const isInMaintenance = maintenanceStatus.enabled && !isUserAllowed && !isAdmin;

    const isFeatureEnabled = useCallback((feature: string): boolean => {
        return featureFlags[feature] ?? true;
    }, [featureFlags]);

    const setFeatureFlag = useCallback(async (flag: string, enabled: boolean) => {
        const next = { ...featureFlags, [flag]: enabled };
        setFeatureFlags(next);
        const data = await updateAppConfig({ features: { [flag]: enabled } });
        applyConfig(data);
    }, [applyConfig, featureFlags]);

    const setMaintenanceMode = useCallback(async (enabled: boolean, message?: string) => {
        const next = {
            ...maintenanceStatus,
            enabled,
            message: message ?? maintenanceStatus.message,
        };
        setMaintenanceStatus(next);
        const data = await updateAppConfig({ maintenance: next });
        applyConfig(data);
    }, [applyConfig, maintenanceStatus]);

    const setAnnouncement = useCallback(async (newAnnouncement: Partial<AppAnnouncement>) => {
        const next = {
            enabled: false,
            title: '',
            message: '',
            type: 'info' as const,
            dismissible: true,
            ...(announcement ?? {}),
            ...newAnnouncement,
        };
        setAnnouncementState(next.enabled ? next : null);
        const data = await updateAppConfig({ announcement: next });
        applyConfig(data);
    }, [announcement, applyConfig]);

    const setTaxSettings = useCallback(async (settingsPatch: Partial<TaxSettings>) => {
        const next = { ...taxSettings, ...settingsPatch };
        setTaxSettingsState(next);
        const data = await updateAppConfig({
            vat: {
                display_mode: next.enabled ? 'exclusive' : 'inclusive',
                rate: (next.rate * 100).toFixed(2),
            },
        });
        applyConfig(data);
    }, [applyConfig, taxSettings]);

    const setUpdateSettings = useCallback(async (settingsPatch: Partial<UpdateSettings>) => {
        const next = { ...updateSettings, ...settingsPatch };
        setUpdateSettingsState(next);
        const data = await updateAppConfig({ update_settings: next });
        applyConfig(data);
    }, [applyConfig, updateSettings]);

    const value: RemoteConfigContextType = useMemo(() => ({
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
        setUpdateSettings,
        reloadConfig,
    }), [
        announcement,
        featureFlags,
        isFeatureEnabled,
        isInMaintenance,
        isLoading,
        maintenanceStatus,
        reloadConfig,
        setAnnouncement,
        setFeatureFlag,
        setMaintenanceMode,
        setTaxSettings,
        setUpdateSettings,
        taxSettings,
        updateSettings,
    ]);

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
