import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useData } from '@/contexts/DataContext';
import Input from '@/components/Input';
import Button from '@/components/Button';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';

interface AlertConfig {
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[];
}

export default function AddCustomerPage() {
    const { editId } = useLocalSearchParams<{ editId?: string }>();
    const router = useRouter();
    const { getCustomerById, addCustomer, updateCustomer } = useData();
    const isEditing = !!editId;

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        company: '',
    });

    const [alertConfig, setAlertConfig] = useState<AlertConfig>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        buttons: [],
    });

    // Load customer data if editing
    useEffect(() => {
        if (editId) {
            const customer = getCustomerById(editId as string);
            if (customer) {
                setFormData({
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email,
                    address: customer.address,
                    company: customer.company || '',
                });
            }
        }
    }, [editId, getCustomerById]);

    const showAlert = (config: Omit<AlertConfig, 'visible'>) => {
        setAlertConfig({ ...config, visible: true });
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.phone.trim()) {
            showAlert({
                title: 'Missing Information',
                message: 'Please fill in customer name and phone number.',
                type: 'warning',
                buttons: [{ text: 'OK', style: 'default' }],
            });
            return;
        }

        try {
            if (isEditing && editId) {
                await updateCustomer(editId as string, {
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    company: formData.company,
                });
            } else {
                await addCustomer({
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address,
                    company: formData.company,
                    isActive: true,
                });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            showAlert({
                title: isEditing ? 'Customer Updated' : 'Customer Added',
                message: isEditing
                    ? 'Customer information has been updated successfully.'
                    : 'New customer has been added successfully.',
                type: 'success',
                buttons: [{
                    text: 'OK',
                    style: 'default',
                    onPress: () => router.back(),
                }],
            });
        } catch (error) {
            console.error('Error saving customer:', error);
            showAlert({
                title: 'Error',
                message: 'Failed to save customer. Please try again.',
                type: 'error',
                buttons: [{ text: 'OK', style: 'default' }],
            });
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false, presentation: 'card' }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isEditing ? 'Edit Customer' : 'New Customer'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.formContainer}>
                    <Input
                        label="Customer Name"
                        placeholder="Enter customer name"
                        value={formData.name}
                        onChangeText={(text) => setFormData({ ...formData, name: text })}
                        containerStyle={styles.inputContainer}
                    />
                    <Input
                        label="Company (Optional)"
                        placeholder="Enter company name"
                        value={formData.company}
                        onChangeText={(text) => setFormData({ ...formData, company: text })}
                        containerStyle={styles.inputContainer}
                    />
                    <Input
                        label="Phone Number"
                        placeholder="Enter phone number"
                        value={formData.phone}
                        onChangeText={(text) => setFormData({ ...formData, phone: text })}
                        keyboardType="phone-pad"
                        containerStyle={styles.inputContainer}
                    />
                    <Input
                        label="Email (Optional)"
                        placeholder="Enter email address"
                        value={formData.email}
                        onChangeText={(text) => setFormData({ ...formData, email: text })}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        containerStyle={styles.inputContainer}
                    />
                    <Input
                        label="Address (Optional)"
                        placeholder="Enter address"
                        value={formData.address}
                        onChangeText={(text) => setFormData({ ...formData, address: text })}
                        multiline
                        numberOfLines={3}
                        containerStyle={styles.inputContainer}
                    />
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Button
                    title={isEditing ? 'Save Changes' : 'Add Customer'}
                    onPress={handleSave}
                    fullWidth
                    size="lg"
                />
            </View>

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
    content: {
        flex: 1,
    },
    formContainer: {
        padding: 20,
    },
    inputContainer: {
        marginBottom: 16,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.light.borderLight,
    },
});
