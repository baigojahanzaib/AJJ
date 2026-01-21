import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import * as Updates from 'expo-updates';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

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
            setStatusText('Development mode - skipping updates');
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
                setStatusText('App is up to date!');
                animateProgress(1, 500);
                setTimeout(() => fadeOutAndComplete(), 800);
                return;
            }

            // Phase 2: Downloading update
            setUpdateState('downloading');
            setStatusText('Downloading update...');
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
                setStatusText('App is up to date!');
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

    // Update complete - show children
    if (updateState === 'done') {
        return <>{children}</>;
    }

    // Show full-screen update screen (Clash Royale style)
    return (
        <>
            {/* Pre-render children behind the update screen for faster transition */}
            <View style={styles.hiddenChildren}>{children}</View>

            <Animated.View style={[styles.updateScreen, { opacity: fadeAnim }]}>
                <LinearGradient
                    colors={['#0f0f1a', '#1a1a2e', '#16213e']}
                    style={styles.gradient}
                >
                    {/* App Logo/Icon Area */}
                    <View style={styles.logoContainer}>
                        <Text style={styles.appIcon}>📦</Text>
                        <Text style={styles.appName}>e-Order</Text>
                        <Text style={styles.versionText}>v{appVersion}</Text>
                    </View>

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
                            >
                                <LinearGradient
                                    colors={['#4f46e5', '#7c3aed', '#a855f7']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.progressGradient}
                                />
                            </Animated.View>
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

                    {/* Loading dots animation */}
                    {updateState !== 'error' && (
                        <View style={styles.dotsContainer}>
                            <LoadingDots />
                        </View>
                    )}
                </LinearGradient>
            </Animated.View>
        </>
    );
}

// Animated loading dots component
function LoadingDots() {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animateDot = (dot: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0.3,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        };

        animateDot(dot1, 0);
        animateDot(dot2, 150);
        animateDot(dot3, 300);
    }, []);

    return (
        <View style={styles.dots}>
            <Animated.View style={[styles.dot, { opacity: dot1 }]} />
            <Animated.View style={[styles.dot, { opacity: dot2 }]} />
            <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    content: {
        alignItems: 'center',
        padding: 32,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 60,
    },
    appIcon: {
        fontSize: 80,
        marginBottom: 16,
    },
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 2,
    },
    versionText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
    },
    statusContainer: {
        alignItems: 'center',
        marginBottom: 32,
        minHeight: 50,
    },
    statusText: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#f87171',
        textAlign: 'center',
        marginTop: 8,
    },
    progressContainer: {
        width: '100%',
        alignItems: 'center',
    },
    progressTrack: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressGradient: {
        flex: 1,
    },
    progressPercent: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 12,
    },
    dotsContainer: {
        marginTop: 40,
    },
    dots: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4f46e5',
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
    retryButton: {
        backgroundColor: '#4f46e5',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 24,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
