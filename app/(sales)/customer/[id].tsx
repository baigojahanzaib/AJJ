import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Phone, Mail, MapPin, Building2, Edit2, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useData } from '@/contexts/DataContext';
import Card from '@/components/Card';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

interface AlertConfig {
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
}

export default function CustomerDetailPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [alertConfig, setAlertConfig] = useState<AlertConfig>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: [],
    });

    const { getCustomerById, updateCustomer } = useData();
    const customer = getCustomerById(id as string);

    const showAlert = (config: Omit<AlertConfig, 'visible'>) => {
        setAlertConfig({ ...config, visible: true });
    };

    const handleEdit = () => {
        router.push(`/(sales)/customer/add?editId=${id}`);
    };

    const handleDelete = () => {
        if (!customer) return;

        showAlert({
            title: 'Delete Customer',
            message: `Are you sure you want to delete ${customer.name}?`,
            type: 'warning',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await updateCustomer(id as string, { isActive: false });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            router.back();
                        } catch (error) {
                            console.error('Error deleting customer:', error);
                        }
                    },
                },
            ],
        });
    };

    const handleOpenMap = (lat: number, lng: number) => {
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${lat},${lng}`;
        const label = 'Customer Location';
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });

        if (url) {
            Linking.openURL(url);
        }
    };

    if (!customer) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color={Colors.light.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Customer Not Found</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Customer not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Customer Details</Text>
                <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
                    <Edit2 size={22} color={Colors.light.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                    <View style={styles.detailAvatar}>
                        <Text style={styles.detailAvatarText}>
                            {customer.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.detailName}>{customer.name}</Text>
                    {customer.company && (
                        <Text style={styles.detailCompany}>{customer.company}</Text>
                    )}
                </View>

                <View style={styles.detailSection}>
                    <Card padding="none">
                        <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                                <Phone size={18} color={Colors.light.primary} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Phone</Text>
                                <Text style={styles.detailValue}>{customer.phone}</Text>
                            </View>
                        </View>

                        {customer.email && (
                            <>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <View style={styles.detailIcon}>
                                        <Mail size={18} color={Colors.light.primary} />
                                    </View>
                                    <View style={styles.detailContent}>
                                        <Text style={styles.detailLabel}>Email</Text>
                                        <Text style={styles.detailValue}>{customer.email}</Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {customer.address && (
                            <>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <View style={styles.detailIcon}>
                                        <MapPin size={18} color={Colors.light.primary} />
                                    </View>
                                    <View style={styles.detailContent}>
                                        <Text style={styles.detailLabel}>Address</Text>
                                        <Text style={styles.detailValue}>{customer.address}</Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {(customer.latitude !== undefined && customer.longitude !== undefined) && (
                            <>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <View style={styles.detailIcon}>
                                        <MapPin size={18} color={Colors.light.primary} />
                                    </View>
                                    <View style={styles.detailContent}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={styles.detailLabel}>Grid Coordinates</Text>
                                            <TouchableOpacity onPress={() => handleOpenMap(customer.latitude!, customer.longitude!)}>
                                                <Text style={{ fontSize: 12, color: Colors.light.primary, fontWeight: '600' }}>View on Map</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={[styles.detailValue, { fontFamily: 'monospace', fontSize: 13 }]}>
                                            {customer.latitude.toFixed(6)}, {customer.longitude.toFixed(6)}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {customer.company && (
                            <>
                                <View style={styles.detailDivider} />
                                <View style={styles.detailRow}>
                                    <View style={styles.detailIcon}>
                                        <Building2 size={18} color={Colors.light.primary} />
                                    </View>
                                    <View style={styles.detailContent}>
                                        <Text style={styles.detailLabel}>Company</Text>
                                        <Text style={styles.detailValue}>{customer.company}</Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </Card>
                </View>

                <View style={styles.detailSection}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={handleDelete}
                    >
                        <Trash2 size={18} color={Colors.light.danger} />
                        <Text style={styles.deleteButtonText}>Delete Customer</Text>
                    </TouchableOpacity>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.borderLight,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600' as const,
        color: Colors.light.text,
    },
    backButton: {
        padding: 4,
    },
    editButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: Colors.light.textTertiary,
    },
    detailHeader: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    detailAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.light.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    detailAvatarText: {
        fontSize: 32,
        fontWeight: '600' as const,
        color: Colors.light.primary,
    },
    detailName: {
        fontSize: 24,
        fontWeight: '700' as const,
        color: Colors.light.text,
        textAlign: 'center',
    },
    detailCompany: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    detailSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    detailIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.light.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    detailContent: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: Colors.light.textTertiary,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 15,
        color: Colors.light.text,
    },
    detailDivider: {
        height: 1,
        backgroundColor: Colors.light.borderLight,
        marginHorizontal: 14,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.light.dangerLight,
        paddingVertical: 14,
        borderRadius: 12,
    },
    deleteButtonText: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: Colors.light.danger,
    },
});
