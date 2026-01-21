import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ArrowLeft, RefreshCw, Check, AlertCircle, Clock, Package, Folder, Settings2, Zap
} from 'lucide-react-native';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import Card from '@/components/Card';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

export default function EcwidSync() {
    const router = useRouter();

    // Convex queries and mutations
    const settings = useQuery(api.ecwid.getSettings);
    const syncStatus = useQuery(api.ecwid.getSyncStatus);
    const saveSettingsMutation = useMutation(api.ecwid.saveSettings);
    const testConnectionAction = useAction(api.ecwid.testConnection);
    const fullSyncAction = useAction(api.ecwid.fullSync);


    // Local state
    const [storeId, setStoreId] = useState('32555156');
    const [accessToken, setAccessToken] = useState('secret_KTawLq5R9xb2PfxX5ynP2uMV5k2igWES');
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info' as 'success' | 'error' | 'warning' | 'info',
        buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
    });

    // Load existing settings
    useEffect(() => {
        if (settings) {
            setStoreId(settings.storeId || '');
            setAutoSyncEnabled(settings.autoSyncEnabled || false);
            // Don't set access token - it's masked
        }
    }, [settings]);

    const showAlert = (
        title: string,
        message: string,
        type: 'success' | 'error' | 'warning' | 'info' = 'info'
    ) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            buttons: [{ text: 'OK', style: 'default' }],
        });
    };

    const handleSaveSettings = async () => {
        if (!storeId.trim()) {
            showAlert('Missing Store ID', 'Please enter your Ecwid Store ID', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            await saveSettingsMutation({
                storeId: storeId.trim(),
                accessToken: accessToken.trim() || undefined,
                autoSyncEnabled,
            });
            showAlert('Settings Saved', 'Your Ecwid settings have been saved successfully.', 'success');
            setAccessToken(''); // Clear token field after save
        } catch (error) {
            showAlert('Error', `Failed to save settings: ${error}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!storeId.trim()) {
            showAlert('Missing Store ID', 'Please enter your Ecwid Store ID', 'warning');
            return;
        }

        const tokenToTest = accessToken.trim() || (settings?.hasAccessToken ? 'USE_SAVED' : '');
        if (!tokenToTest || tokenToTest === 'USE_SAVED') {
            // If using saved token, we need to save first then test
            if (!settings?.hasAccessToken && !accessToken.trim()) {
                showAlert('Missing Access Token', 'Please enter your Ecwid Access Token', 'warning');
                return;
            }
        }

        setIsTesting(true);
        try {
            // Save settings first if token is new
            if (accessToken.trim()) {
                await saveSettingsMutation({
                    storeId: storeId.trim(),
                    accessToken: accessToken.trim(),
                    autoSyncEnabled,
                });
            }

            const result = await testConnectionAction({
                storeId: storeId.trim(),
                accessToken: accessToken.trim() || settings?.accessToken || '',
            });

            if (result.success) {
                showAlert('Connection Successful', result.message, 'success');
            } else {
                showAlert('Connection Failed', result.message, 'error');
            }
        } catch (error) {
            showAlert('Error', `Connection test failed: ${error}`, 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleSync = async () => {
        if (!syncStatus?.configured) {
            showAlert('Not Configured', 'Please configure your Ecwid settings first.', 'warning');
            return;
        }

        setIsSyncing(true);
        try {
            const result = await fullSyncAction({});
            showAlert(
                'Sync Complete',
                `Successfully synced ${result.categoryCount} categories and ${result.productCount} products.`,
                'success'
            );
        } catch (error) {
            showAlert('Sync Failed', `${error}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    };



    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const getSyncStatusColor = () => {
        switch (syncStatus?.lastSyncStatus) {
            case 'success': return Colors.light.success;
            case 'error': return Colors.light.danger;
            case 'in_progress': return Colors.light.warning;
            default: return Colors.light.textTertiary;
        }
    };

    const getSyncStatusIcon = () => {
        switch (syncStatus?.lastSyncStatus) {
            case 'success': return <Check size={16} color={Colors.light.success} />;
            case 'error': return <AlertCircle size={16} color={Colors.light.danger} />;
            case 'in_progress': return <ActivityIndicator size="small" color={Colors.light.warning} />;
            default: return <Clock size={16} color={Colors.light.textTertiary} />;
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <ArrowLeft size={24} color={Colors.light.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Ecwid Sync</Text>
                </View>

                {/* Description */}
                <View style={styles.descriptionContainer}>
                    <Text style={styles.description}>
                        Connect your Ecwid store to sync products, categories, and variations automatically.
                    </Text>
                </View>

                {/* Sync Status Card */}
                <Card style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={styles.statusIconContainer}>
                            <RefreshCw size={20} color={Colors.light.primary} />
                        </View>
                        <Text style={styles.statusTitle}>Sync Status</Text>
                    </View>

                    <View style={styles.statusGrid}>
                        <View style={styles.statusItem}>
                            <View style={styles.statusItemIcon}>
                                {getSyncStatusIcon()}
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Status</Text>
                                <Text style={[styles.statusValue, { color: getSyncStatusColor() }]}>
                                    {syncStatus?.lastSyncStatus || 'Not synced'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.statusItem}>
                            <View style={styles.statusItemIcon}>
                                <Clock size={16} color={Colors.light.textSecondary} />
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Last Sync</Text>
                                <Text style={styles.statusValue}>
                                    {formatDate(syncStatus?.lastSyncAt ?? null)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.statusItem}>
                            <View style={styles.statusItemIcon}>
                                <Folder size={16} color={Colors.light.textSecondary} />
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Categories</Text>
                                <Text style={styles.statusValue}>
                                    {syncStatus?.lastSyncCategoryCount ?? '-'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.statusItem}>
                            <View style={styles.statusItemIcon}>
                                <Package size={16} color={Colors.light.textSecondary} />
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Products</Text>
                                <Text style={styles.statusValue}>
                                    {syncStatus?.lastSyncProductCount ?? '-'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {syncStatus?.lastSyncMessage && (
                        <View style={styles.messageContainer}>
                            <Text style={[
                                styles.messageText,
                                { color: syncStatus.lastSyncStatus === 'error' ? Colors.light.danger : Colors.light.textSecondary }
                            ]}>
                                {syncStatus.lastSyncMessage}
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.syncButton,
                            (!syncStatus?.configured || isSyncing) && styles.syncButtonDisabled
                        ]}
                        onPress={handleSync}
                        disabled={!syncStatus?.configured || isSyncing}
                    >
                        {isSyncing ? (
                            <ActivityIndicator color={Colors.light.primaryForeground} />
                        ) : (
                            <>
                                <RefreshCw size={20} color={Colors.light.primaryForeground} />
                                <Text style={styles.syncButtonText}>Sync Now</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Card>

                {/* Configuration Card */}
                <Card style={styles.configCard}>
                    <View style={styles.configHeader}>
                        <View style={styles.statusIconContainer}>
                            <Settings2 size={20} color={Colors.light.primary} />
                        </View>
                        <Text style={styles.configTitle}>Configuration</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Store ID</Text>
                        <TextInput
                            style={styles.input}
                            value={storeId}
                            onChangeText={setStoreId}
                            placeholder="Enter your Ecwid Store ID"
                            placeholderTextColor={Colors.light.textTertiary}
                            keyboardType="numeric"
                        />
                        <Text style={styles.inputHint}>
                            Find this in your Ecwid admin under Settings → API
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Access Token</Text>
                        <TextInput
                            style={styles.input}
                            value={accessToken}
                            onChangeText={setAccessToken}
                            placeholder={settings?.hasAccessToken ? "••••••••• (saved)" : "Enter your Access Token"}
                            placeholderTextColor={Colors.light.textTertiary}
                            secureTextEntry
                        />
                        <Text style={styles.inputHint}>
                            Generate a private token in your Ecwid API settings
                        </Text>
                    </View>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.secondaryButton, isTesting && styles.buttonDisabled]}
                            onPress={handleTestConnection}
                            disabled={isTesting}
                        >
                            {isTesting ? (
                                <ActivityIndicator color={Colors.light.primary} />
                            ) : (
                                <Text style={styles.secondaryButtonText}>Test Connection</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
                            onPress={handleSaveSettings}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color={Colors.light.primaryForeground} />
                            ) : (
                                <Text style={styles.primaryButtonText}>Save Settings</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Card>

                {/* Auto-Sync Card */}
                <Card style={styles.autoSyncCard}>
                    <View style={styles.autoSyncRow}>
                        <View style={styles.autoSyncInfo}>
                            <View style={styles.statusIconContainer}>
                                <Zap size={20} color={Colors.light.primary} />
                            </View>
                            <View style={styles.autoSyncText}>
                                <Text style={styles.autoSyncTitle}>Auto-Sync</Text>
                                <Text style={styles.autoSyncDescription}>
                                    Automatically sync every 24 hours
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={autoSyncEnabled}
                            onValueChange={setAutoSyncEnabled}
                            trackColor={{
                                false: Colors.light.surfaceSecondary,
                                true: Colors.light.primaryLight
                            }}
                            thumbColor={autoSyncEnabled ? Colors.light.primary : Colors.light.textTertiary}
                        />
                    </View>
                </Card>



                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Products synced from Ecwid will be marked with an Ecwid ID.{'\n'}
                        Existing products will be updated, not duplicated.
                    </Text>
                </View>
            </ScrollView>

            <ThemedAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                buttons={alertConfig.buttons}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.light.text,
    },
    descriptionContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    description: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        lineHeight: 22,
    },
    statusCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 16,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.light.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.light.text,
    },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 16,
    },
    statusItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '50%',
        marginBottom: 12,
    },
    statusItemIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: Colors.light.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    statusLabel: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginBottom: 2,
    },
    statusValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.text,
    },
    messageContainer: {
        backgroundColor: Colors.light.surfaceSecondary,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    messageText: {
        fontSize: 13,
        lineHeight: 18,
    },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    syncButtonDisabled: {
        backgroundColor: Colors.light.textTertiary,
    },
    syncButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.primaryForeground,
    },
    configCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 16,
    },
    configHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    configTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.light.text,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: Colors.light.surfaceSecondary,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: Colors.light.text,
    },
    inputHint: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginTop: 6,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: Colors.light.primaryLight,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    primaryButton: {
        flex: 1,
        backgroundColor: Colors.light.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.light.primaryForeground,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    autoSyncCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 16,
    },
    autoSyncRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    autoSyncInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    autoSyncText: {
        flex: 1,
    },
    autoSyncTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 2,
    },
    autoSyncDescription: {
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    footerText: {
        fontSize: 13,
        color: Colors.light.textTertiary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
