import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Database, RefreshCw, ShieldCheck } from 'lucide-react-native';
import Card from '@/components/Card';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

export default function EcwidSync() {
    const router = useRouter();
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info' as 'success' | 'error' | 'warning' | 'info',
        buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
    });

    const showRetiredMessage = () => {
        setAlertConfig({
            visible: true,
            title: 'Legacy Sync Retired',
            message: 'The app now reads and writes catalog, customer, order, and admin data through the website API backed by Supabase.',
            type: 'info',
            buttons: [{ text: 'OK', style: 'default' }],
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ArrowLeft size={24} color={Colors.light.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Data Sync</Text>
                </View>

                <View style={styles.descriptionContainer}>
                    <Text style={styles.description}>
                        The legacy store integration has been removed from the active data path. Supabase-backed website APIs are now the source of truth.
                    </Text>
                </View>

                <Card style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={styles.statusIconContainer}>
                            <ShieldCheck size={20} color={Colors.light.success} />
                        </View>
                        <Text style={styles.statusTitle}>Migration Status</Text>
                    </View>

                    <View style={styles.statusGrid}>
                        <View style={styles.statusItem}>
                            <View style={styles.statusItemIcon}>
                                <Database size={16} color={Colors.light.success} />
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Source</Text>
                                <Text style={[styles.statusValue, { color: Colors.light.success }]}>
                                    Website API / Supabase
                                </Text>
                            </View>
                        </View>

                        <View style={styles.statusItem}>
                            <View style={styles.statusItemIcon}>
                                <RefreshCw size={16} color={Colors.light.textSecondary} />
                            </View>
                            <View>
                                <Text style={styles.statusLabel}>Legacy Store</Text>
                                <Text style={styles.statusValue}>Retired</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.primaryButton} onPress={showRetiredMessage}>
                        <Text style={styles.primaryButtonText}>View Current Sync Path</Text>
                    </TouchableOpacity>
                </Card>

                <Card style={styles.configCard}>
                    <Text style={styles.configTitle}>Current Responsibilities</Text>
                    <Text style={styles.bullet}>Catalog: products and categories load from the website API.</Text>
                    <Text style={styles.bullet}>Orders: sales and client orders post back to the website admin.</Text>
                    <Text style={styles.bullet}>Admin changes: products, customers, users, and order statuses write through the same API.</Text>
                </Card>
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
    configCard: {
        marginHorizontal: 20,
        marginBottom: 16,
        padding: 16,
    },
    configTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 12,
    },
    bullet: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        lineHeight: 22,
        marginBottom: 8,
    },
    primaryButton: {
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
});
