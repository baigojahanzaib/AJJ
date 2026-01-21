import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import * as Updates from 'expo-updates';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import Constants from 'expo-constants';
import Colors from '@/constants/colors';

interface UpdateHandlerProps {
    children: React.ReactNode;
}

const { width } = Dimensions.get('window');

export function UpdateHandler({ children }: UpdateHandlerProps) {
    const [updateState, setUpdateState] = useState<'checking' | 'downloading' | 'ready' | 'done' | 'error'>('checking');
    const [statusText, setStatusText] = useState('Checking for updates...');
    const [error, setError] = useState<string | null>(null);

    // Animated progress value (0 to 1)
    const progressAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Get remote config for maintenance
    const { isInMaintenance, maintenanceStatus, isLoading } = useRemoteConfig();

    const appVersion = Constants.expoConfig?.version || '1.0.0';

    useEffect(() => {
        handleUpdateFlow();
    }, []);

    const animateProgress = (toValue: number, duration: number = 500) => {
        Animated.timing(progressAnim, {
            toValue,
            duration,
            useNativeDriver: false,
        }).start();
    };

    const handleUpdateFlow = async () => {
        // Skip in development
        if (__DEV__ || !Updates.isEnabled) {
            setStatusText('Development setup - skipping updates');
            animateProgress(1, 300);
            setTimeout(() => fadeOutAndComplete(), 500);
            return;
        }

        try {
            // Phase 1: Checking for updates
            setUpdateState('checking');
            setStatusText('Checking for updates...');
            animateProgress(0.2, 800);

            const update = await Updates.checkForUpdateAsync();

            if (!update.isAvailable) {
                // No update available - show completion
                setStatusText('App is up to date');
                animateProgress(1, 500);
                setTimeout(() => fadeOutAndComplete(), 800);
                return;
            }

            // Phase 2: Downloading update
            setUpdateState('downloading');
            setStatusText('Downloading new version...');
            animateProgress(0.4, 300);

            // Simulate progress during download (since expo-updates doesn't provide real progress)
            const progressInterval = setInterval(() => {
                progressAnim.setValue(Math.min(0.4 + Math.random() * 0.3, 0.85));
            }, 200);

            const fetchedUpdate = await Updates.fetchUpdateAsync();
            clearInterval(progressInterval);

            if (fetchedUpdate.isNew) {
                // Phase 3: Ready to apply
                setUpdateState('ready');
                setStatusText('Installing update...');
                animateProgress(0.95, 300);

                // Brief pause to show "Installing" message
                await new Promise(resolve => setTimeout(resolve, 500));

                animateProgress(1, 200);
                setStatusText('Restarting app...');

                // Another brief pause before restart
                await new Promise(resolve => setTimeout(resolve, 300));

                // Reload the app with the new update
                await Updates.reloadAsync();
            } else {
                // Update fetched but not new (edge case)
                setStatusText('App is up to date');
                animateProgress(1, 500);
                setTimeout(() => fadeOutAndComplete(), 800);
            }
        } catch (e) {
            console.log('Update error:', e);
            setError('Update check failed. Continuing with current version.');
            setUpdateState('error');
            animateProgress(1, 300);
            setTimeout(() => fadeOutAndComplete(), 1500);
        }
    };

    const fadeOutAndComplete = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setUpdateState('done');
        });
    };

    const retryUpdate = () => {
        setError(null);
        progressAnim.setValue(0);
        fadeAnim.setValue(1);
        handleUpdateFlow();
    };

    // Show maintenance screen if in maintenance mode (redesigned)
    if (!isLoading && isInMaintenance) {
        return (
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.logoWrapper}>
                        <Text style={styles.appIcon}>🔧</Text>
                    </View>
                    <Text style={styles.title}>Under Maintenance</Text>
                    <Text style={styles.message}>
                        {maintenanceStatus.message || 'We\'re currently performing maintenance. Please try again later.'}
                    </Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                            if (Updates.isEnabled) {
                                Updates.reloadAsync();
                            }
                        }}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Update complete - show children
    if (updateState === 'done') {
        return <>{children}</>;
    }

    // Show full-screen update screen (Minimalist Design)
    return (
        <>
            {/* Pre-render children behind the update screen for faster transition */}
            <View style={styles.hiddenChildren}>{children}</View>

            <Animated.View style={[styles.updateScreen, { opacity: fadeAnim }]}>
                <View style={styles.container}>
                    {/* App Logo/Icon Area */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoWrapper}>
                            <Text style={styles.appIcon}>📦</Text>
                        </View>
                        <Text style={styles.appName}>e-Order</Text>
                        <Text style={styles.versionText}>v{appVersion}</Text>
                    </View>

                    <View style={styles.contentContainer}>
                        {/* Status Text */}
                        <View style={styles.statusContainer}>
                            <Text style={styles.statusText}>{statusText}</Text>
                            {error && <Text style={styles.errorText}>{error}</Text>}
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressTrack}>
                                <Animated.View
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: progressAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%'],
                                            }),
                                        },
                                    ]}
                                />
                            </View>

                            {/* Progress percentage */}
                            <Animated.Text style={styles.progressPercent}>
                                {progressAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                })}
                            </Animated.Text>
                        </View>

                        {/* Retry button for errors */}
                        {updateState === 'error' && (
                            <TouchableOpacity style={styles.retryButton} onPress={retryUpdate}>
                                <Text style={styles.retryButtonText}>Retry</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    hiddenChildren: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0,
    },
    updateScreen: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        backgroundColor: Colors.light.background,
    },
    contentContainer: {
        width: '100%',
        alignItems: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 60,
    },
    logoWrapper: {
        width: 100,
        height: 100,
        borderRadius: 24,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: Colors.light.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    appIcon: {
        fontSize: 48,
    },
    appName: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.light.text,
        letterSpacing: -0.5,
    },
    versionText: {
        fontSize: 14,
        color: Colors.light.textTertiary,
        marginTop: 8,
        fontWeight: '500',
    },
    statusContainer: {
        alignItems: 'center',
        marginBottom: 24,
        height: 40,
        justifyContent: 'center',
    },
    statusText: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },
    errorText: {
        fontSize: 14,
        color: Colors.light.danger,
        textAlign: 'center',
        marginTop: 4,
    },
    progressContainer: {
        width: '100%',
        maxWidth: 280,
    },
    progressTrack: {
        width: '100%',
        height: 6,
        backgroundColor: Colors.light.surfaceSecondary,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.light.primary,
        borderRadius: 3,
    },
    progressPercent: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginTop: 12,
        textAlign: 'right',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    retryButton: {
        marginTop: 32,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: Colors.light.primary,
        borderRadius: 12,
    },
    retryButtonText: {
        color: Colors.light.primaryForeground,
        fontSize: 14,
        fontWeight: '600',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
});
