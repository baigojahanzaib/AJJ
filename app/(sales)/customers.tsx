import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Search, X, Phone, Mail, MapPin, Building2, ChevronRight, Edit2, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { mockCustomers } from '@/mocks/customers';
import { Customer } from '@/types';
import Input from '@/components/Input';
import Button from '@/components/Button';
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

export default function SalesCustomers() {
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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

  const showAlert = (config: Omit<AlertConfig, 'visible'>) => {
    setAlertConfig({ ...config, visible: true });
  };

  const activeCustomers = useMemo(() => {
    return customers.filter(c => c.isActive);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return activeCustomers;
    const search = searchQuery.toLowerCase();
    return activeCustomers.filter(
      customer =>
        customer.name.toLowerCase().includes(search) ||
        customer.company?.toLowerCase().includes(search) ||
        customer.phone.includes(search) ||
        customer.email.toLowerCase().includes(search)
    );
  }, [activeCustomers, searchQuery]);

  const openAddModal = () => {
    setFormData({ name: '', phone: '', email: '', address: '', company: '' });
    setIsEditing(false);
    setShowAddModal(true);
  };

  const openDetailModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const openEditModal = () => {
    if (!selectedCustomer) return;
    setFormData({
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      email: selectedCustomer.email,
      address: selectedCustomer.address,
      company: selectedCustomer.company || '',
    });
    setIsEditing(true);
    setShowDetailModal(false);
    setShowAddModal(true);
  };

  const handleSaveCustomer = () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      showAlert({
        title: 'Missing Information',
        message: 'Please fill in customer name and phone number.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (isEditing && selectedCustomer) {
      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomer.id 
          ? { ...c, ...formData }
          : c
      ));
      showAlert({
        title: 'Customer Updated',
        message: 'Customer information has been updated successfully.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } else {
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        company: formData.company || undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setCustomers(prev => [...prev, newCustomer]);
      showAlert({
        title: 'Customer Added',
        message: 'New customer has been added successfully.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddModal(false);
    setSelectedCustomer(null);
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    
    showAlert({
      title: 'Delete Customer',
      message: `Are you sure you want to delete ${selectedCustomer.name}?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCustomers(prev => prev.map(c => 
              c.id === selectedCustomer.id 
                ? { ...c, isActive: false }
                : c
            ));
            setShowDetailModal(false);
            setSelectedCustomer(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    });
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => openDetailModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.customerAvatar}>
        <Text style={styles.customerAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name}</Text>
        {item.company && (
          <Text style={styles.customerCompany}>{item.company}</Text>
        )}
        <Text style={styles.customerPhone}>{item.phone}</Text>
      </View>
      <ChevronRight size={20} color={Colors.light.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.subtitle}>{activeCustomers.length} customer{activeCustomers.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <UserPlus size={22} color={Colors.light.primaryForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={18} color={Colors.light.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor={Colors.light.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={Colors.light.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomerItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No customers found</Text>
            <Button
              title="Add Customer"
              onPress={openAddModal}
              variant="outline"
              style={styles.emptyButton}
            />
          </View>
        }
      />

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isEditing ? 'Edit Customer' : 'New Customer'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView 
            style={styles.formScroll}
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

          <View style={styles.modalFooter}>
            <Button
              title={isEditing ? 'Save Changes' : 'Add Customer'}
              onPress={handleSaveCustomer}
              fullWidth
              size="lg"
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <X size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Customer Details</Text>
            <TouchableOpacity onPress={openEditModal}>
              <Edit2 size={22} color={Colors.light.primary} />
            </TouchableOpacity>
          </View>

          {selectedCustomer && (
            <ScrollView 
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailHeader}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailName}>{selectedCustomer.name}</Text>
                {selectedCustomer.company && (
                  <Text style={styles.detailCompany}>{selectedCustomer.company}</Text>
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
                      <Text style={styles.detailValue}>{selectedCustomer.phone}</Text>
                    </View>
                  </View>
                  
                  {selectedCustomer.email && (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Mail size={18} color={Colors.light.primary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Email</Text>
                          <Text style={styles.detailValue}>{selectedCustomer.email}</Text>
                        </View>
                      </View>
                    </>
                  )}
                  
                  {selectedCustomer.address && (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <MapPin size={18} color={Colors.light.primary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Address</Text>
                          <Text style={styles.detailValue}>{selectedCustomer.address}</Text>
                        </View>
                      </View>
                    </>
                  )}
                  
                  {selectedCustomer.company && (
                    <>
                      <View style={styles.detailDivider} />
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Building2 size={18} color={Colors.light.primary} />
                        </View>
                        <View style={styles.detailContent}>
                          <Text style={styles.detailLabel}>Company</Text>
                          <Text style={styles.detailValue}>{selectedCustomer.company}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </Card>
              </View>

              <View style={styles.detailSection}>
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={handleDeleteCustomer}
                >
                  <Trash2 size={18} color={Colors.light.danger} />
                  <Text style={styles.deleteButtonText}>Delete Customer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

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
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    height: '100%',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  customerAvatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.light.primary,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  customerCompany: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textTertiary,
    marginBottom: 16,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  formScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.borderLight,
  },
  detailScroll: {
    flex: 1,
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
