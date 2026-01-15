import React, { useState } from 'react';
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
import { ChevronLeft, Settings, Bell, Shield, Megaphone, RefreshCw } from 'lucide-react-native';
import { useRemoteConfig } from '@/contexts/RemoteConfigContext';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Colors from '@/constants/colors';
import Card from '@/components/Card';

export default function RemoteConfigScreen() {
    const router = useRouter();
    const {
        featureFlags,
        maintenanceStatus,
        updateSettings,
        announcement,
        isLoading,
        setFeatureFlag,
        setMaintenanceMode,
        setAnnouncement,
    } = useRemoteConfig();

    const setConfigMutation = useMutation(api.appConfig.setConfig);
    const seedDefaultsMutation = useMutation(api.appConfig.seedDefaultConfigs);

    const [maintenanceMessage, setMaintenanceMessage] = useState(maintenanceStatus.message);
    const [announcementTitle, setAnnouncementTitle] = useState(announcement?.title || '');
    const [announcementMessage, setAnnouncementMessage] = useState(announcement?.message || '');
    const [updateMessage, setUpdateMessage] = useState(updateSettings.updateMessage);
    const [isSaving, setIsSaving] = useState(false);

    const handleToggleFeature = async (flag: string, enabled: boolean) => {
        try {
            await setFeatureFlag(flag, enabled);
        } catch (error) {
            Alert.alert('Error', 'Failed to update feature flag');
        }
    };

    const handleToggleMaintenance = async (enabled: boolean) => {
        try {
            await setMaintenanceMode(enabled, maintenanceMessage);
        } catch (error) {
            Alert.alert('Error', 'Failed to update maintenance mode');
        }
    };

    const handleSaveMaintenanceMessage = async () => {
        try {
            setIsSaving(true);
            await setMaintenanceMode(maintenanceStatus.enabled, maintenanceMessage);
            Alert.alert('Success', 'Maintenance message updated');
        } catch (error) {
            Alert.alert('Error', 'Failed to save maintenance message');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleAnnouncement = async (enabled: boolean) => {
        try {
            await setAnnouncement({ enabled });
        } catch (error) {
            Alert.alert('Error', 'Failed to update announcement');
        }
    };

    const handleSaveAnnouncement = async () => {
        try {
            setIsSaving(true);
            await setAnnouncement({
                enabled: announcement?.enabled || false,
                title: announcementTitle,
                message: announcementMessage,
            });
            Alert.alert('Success', 'Announcement updated');
        } catch (error) {
            Alert.alert('Error', 'Failed to save announcement');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleForceUpdate = async (enabled: boolean) => {
        try {
            await setConfigMutation({
                key: 'update_settings',
                value: {
                    ...updateSettings,
                    forceUpdate: enabled,
                },
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to update force update setting');
        }
    };

    const handleSaveUpdateMessage = async () => {
        try {
            setIsSaving(true);
            await setConfigMutation({
                key: 'update_settings',
                value: {
                    ...updateSettings,
                    updateMessage: updateMessage,
                },
            });
            Alert.alert('Success', 'Update message saved');
        } catch (error) {
            Alert.alert('Error', 'Failed to save update message');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSeedDefaults = async () => {
        Alert.alert(
            'Seed Default Configs',
            'This will create default configuration values. Existing values will not be overwritten.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Seed',
                    onPress: async () => {
                        try {
                            await seedDefaultsMutation({});
                            Alert.alert('Success', 'Default configs seeded');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to seed defaults');
                        }
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Loading configuration...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Remote Config</Text>
                <TouchableOpacity onPress={handleSeedDefaults} style={styles.seedButton}>
                    <RefreshCw size={20} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Feature Flags Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Settings size={20} color={Colors.light.info} />
                        <Text style={styles.sectionTitle}>Feature Flags</Text>
                    </View>
                    <Card>
                        {Object.entries(featureFlags).map(([flag, enabled]) => (
                            <View key={flag} style={styles.toggleRow}>
                                <Text style={styles.toggleLabel}>
                                    {flag.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </Text>
                                <Switch
                                    value={enabled}
                                    onValueChange={(value) => handleToggleFeature(flag, value)}
                                    trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
                                    thumbColor="#fff"
                                />
                            </View>
                        ))}
                    </Card>
                </View>

                {/* Maintenance Mode Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Shield size={20} color={Colors.light.danger} />
                        <Text style={styles.sectionTitle}>Maintenance Mode</Text>
                    </View>
                    <Card>
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>Enable Maintenance</Text>
                            <Switch
                                value={maintenanceStatus.enabled}
                                onValueChange={handleToggleMaintenance}
                                trackColor={{ false: Colors.light.border, true: Colors.light.danger }}
                                thumbColor="#fff"
                            />
                        </View>
                        <Text style={styles.inputLabel}>Maintenance Message</Text>
                        <TextInput
                            style={styles.textInput}
                            value={maintenanceMessage}
                            onChangeText={setMaintenanceMessage}
                            placeholder="Enter maintenance message..."
                            placeholderTextColor={Colors.light.inputPlaceholder}
                            multiline
                            numberOfLines={3}
                        />
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveMaintenanceMessage}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSaving ? 'Saving...' : 'Save Message'}
                            </Text>
                        </TouchableOpacity>
                    </Card>
                </View>

                {/* App Announcement Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Megaphone size={20} color={Colors.light.success} />
                        <Text style={styles.sectionTitle}>App Announcement</Text>
                    </View>
                    <Card>
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>Show Announcement</Text>
                            <Switch
                                value={announcement?.enabled || false}
                                onValueChange={handleToggleAnnouncement}
                                trackColor={{ false: Colors.light.border, true: Colors.light.success }}
                                thumbColor="#fff"
                            />
                        </View>
                        <Text style={styles.inputLabel}>Title</Text>
                        <TextInput
                            style={styles.textInputSmall}
                            value={announcementTitle}
                            onChangeText={setAnnouncementTitle}
                            placeholder="Announcement title..."
                            placeholderTextColor={Colors.light.inputPlaceholder}
                        />
                        <Text style={styles.inputLabel}>Message</Text>
                        <TextInput
                            style={styles.textInput}
                            value={announcementMessage}
                            onChangeText={setAnnouncementMessage}
                            placeholder="Announcement message..."
                            placeholderTextColor={Colors.light.inputPlaceholder}
                            multiline
                            numberOfLines={3}
                        />
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveAnnouncement}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSaving ? 'Saving...' : 'Save Announcement'}
                            </Text>
                        </TouchableOpacity>
                    </Card>
                </View>

                {/* Update Settings Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Bell size={20} color={Colors.light.warning} />
                        <Text style={styles.sectionTitle}>Update Settings</Text>
                    </View>
                    <Card>
                        <View style={styles.toggleRow}>
                            <View>
                                <Text style={styles.toggleLabel}>Force Update</Text>
                                <Text style={styles.toggleDescription}>
                                    Users must update to continue
                                </Text>
                            </View>
                            <Switch
                                value={updateSettings.forceUpdate}
                                onValueChange={handleToggleForceUpdate}
                                trackColor={{ false: Colors.light.border, true: Colors.light.warning }}
                                thumbColor="#fff"
                            />
                        </View>
                        <Text style={styles.inputLabel}>Update Message</Text>
                        <TextInput
                            style={styles.textInput}
                            value={updateMessage}
                            onChangeText={setUpdateMessage}
                            placeholder="Update prompt message..."
                            placeholderTextColor={Colors.light.inputPlaceholder}
                            multiline
                            numberOfLines={3}
                        />
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSaveUpdateMessage}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSaving ? 'Saving...' : 'Save Message'}
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
    seedButton: {
        padding: 8,
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
    textInput: {
        backgroundColor: Colors.light.inputBackground,
        borderRadius: 12,
        padding: 14,
        color: Colors.light.text,
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: Colors.light.inputBorder,
    },
    textInputSmall: {
        backgroundColor: Colors.light.inputBackground,
        borderRadius: 12,
        padding: 14,
        color: Colors.light.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: Colors.light.inputBorder,
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
    infoCard: {
        borderLeftWidth: 4,
        borderLeftColor: Colors.light.info,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
    },
    codeText: {
        fontFamily: 'monospace',
        backgroundColor: Colors.light.surfaceSecondary,
        color: Colors.light.info,
        paddingHorizontal: 4,
    },
});
