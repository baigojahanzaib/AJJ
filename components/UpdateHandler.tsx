import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import * as Updates from 'expo-updates';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import { LinearGradient } from 'expo-linear-gradient';

interface UpdateHandlerProps {
    children: React.ReactNode;
}

export function UpdateHandler({ children }: UpdateHandlerProps) {
    const [isChecking, setIsChecking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get remote config for force update and maintenance
    const { updateSettings, isInMaintenance, maintenanceStatus, isLoading } = useRemoteConfig();

    // Check for updates on mount
    useEffect(() => {
        checkForUpdates();
    }, []);

    const checkForUpdates = useCallback(async () => {
        // Skip in development or if updates module is not available
        if (__DEV__ || !Updates.isEnabled) {
            return;
        }

        try {
            setIsChecking(true);
            setError(null);

            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                setUpdateAvailable(true);

                // If force update is enabled, download immediately
                if (updateSettings.forceUpdate) {
                    await downloadAndApplyUpdate();
                }
            }
        } catch (e) {
            console.log('Error checking for updates:', e);
            // Don't show error to user, just log it
        } finally {
            setIsChecking(false);
        }
    }, [updateSettings.forceUpdate]);

    const downloadAndApplyUpdate = async () => {
        try {
            setIsDownloading(true);
            setError(null);

            // Download the update
            const update = await Updates.fetchUpdateAsync();

            if (update.isNew) {
                // Reload the app to apply the update
                await Updates.reloadAsync();
            }
        } catch (e) {
            console.log('Error downloading update:', e);
            setError('Failed to download update. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const dismissUpdate = () => {
        if (!updateSettings.forceUpdate) {
            setUpdateAvailable(false);
        }
    };

    // Show maintenance screen if in maintenance mode
    if (!isLoading && isInMaintenance) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['#1a1a2e', '#16213e']}
                    style={styles.gradient}
                >
                    <View style={styles.content}>
                        <Text style={styles.icon}>🔧</Text>
                        <Text style={styles.title}>Under Maintenance</Text>
                        <Text style={styles.message}>
                            {maintenanceStatus.message || 'We\'re currently performing maintenance. Please try again later.'}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                // Force re-check by refreshing the app
                                if (Updates.isEnabled) {
                                    Updates.reloadAsync();
                                }
                            }}
                        >
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // Show update modal if update is available
    if (updateAvailable) {
        return (
            <>
                {children}
                <Modal
                    visible={updateAvailable}
                    transparent
                    animationType="fade"
                    onRequestClose={updateSettings.forceUpdate ? undefined : dismissUpdate}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalIcon}>🚀</Text>
                            <Text style={styles.modalTitle}>Update Available</Text>
                            <Text style={styles.modalMessage}>
                                {updateSettings.updateMessage || 'A new version is available!'}
                            </Text>

                            {isDownloading ? (
                                <View style={styles.progressContainer}>
                                    <ActivityIndicator size="large" color="#4f46e5" />
                                    <Text style={styles.progressText}>Downloading update...</Text>
                                </View>
                            ) : (
                                <View style={styles.buttonContainer}>
                                    <TouchableOpacity
                                        style={styles.updateButton}
                                        onPress={downloadAndApplyUpdate}
                                    >
                                        <Text style={styles.updateButtonText}>Update Now</Text>
                                    </TouchableOpacity>

                                    {!updateSettings.forceUpdate && (
                                        <TouchableOpacity
                                            style={styles.laterButton}
                                            onPress={dismissUpdate}
                                        >
                                            <Text style={styles.laterButtonText}>Later</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {error && (
                                <Text style={styles.errorText}>{error}</Text>
                            )}
                        </View>
                    </View>
                </Modal>
            </>
        );
    }

    // Show loading indicator while checking (only on initial load with force update)
    if (isChecking && updateSettings.forceUpdate) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['#1a1a2e', '#16213e']}
                    style={styles.gradient}
                >
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.checkingText}>Checking for updates...</Text>
                </LinearGradient>
            </View>
        );
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        padding: 32,
    },
    icon: {
        fontSize: 64,
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    checkingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#94a3b8',
    },
    retryButton: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
    },
    modalIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    modalMessage: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    progressContainer: {
        alignItems: 'center',
    },
    progressText: {
        marginTop: 12,
        fontSize: 14,
        color: '#94a3b8',
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    updateButton: {
        backgroundColor: '#4f46e5',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    laterButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    laterButtonText: {
        color: '#94a3b8',
        fontSize: 16,
    },
    errorText: {
        marginTop: 16,
        color: '#ef4444',
        fontSize: 14,
        textAlign: 'center',
    },
});
