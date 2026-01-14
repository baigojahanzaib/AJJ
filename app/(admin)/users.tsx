import { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Plus, UserCheck, UserX, Edit2 } from 'lucide-react-native';
import { useData } from '@/contexts/DataContext';
import SearchBar from '@/components/SearchBar';
import UserCard from '@/components/UserCard';
import Button from '@/components/Button';
import ThemedAlert from '@/components/ThemedAlert';
import UserFormModal from '@/components/UserFormModal';
import Colors from '@/constants/colors';
import { User } from '@/types';

export default function AdminUsers() {
  const { users, updateUser, addUser, getOrdersBySalesRep } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserActions, setShowUserActions] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  const salesReps = users.filter(user => user.role === 'sales_rep');

  const filteredUsers = salesReps.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterActive === null || user.isActive === filterActive;
    return matchesSearch && matchesFilter;
  });

  const handleUserPress = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    setSelectedUser(user);
    setShowUserActions(true);
  };

  const handleViewUser = () => {
    if (!selectedUser) return;

    const userOrders = getOrdersBySalesRep(selectedUser.id);
    const totalSales = userOrders.reduce((sum, order) => sum + order.total, 0);

    setShowUserActions(false);
    setAlertConfig({
      visible: true,
      title: selectedUser.name,
      message: `Email: ${selectedUser.email}\nPhone: ${selectedUser.phone}\nRole: ${selectedUser.role === 'admin' ? 'Admin' : 'Sales Rep'}\nOrders: ${userOrders.length}\nTotal Sales: $${totalSales.toFixed(2)}\nStatus: ${selectedUser.isActive ? 'Active' : 'Inactive'}\nJoined: ${new Date(selectedUser.createdAt).toLocaleDateString()}`,
      type: 'info',
      buttons: [{ text: 'Close', style: 'default' }],
    });
  };

  const handleEditUser = () => {
    if (!selectedUser) return;
    setShowUserActions(false);
    setEditingUser(selectedUser);
    setShowUserModal(true);
  };

  const handleToggleStatus = () => {
    if (!selectedUser) return;
    
    setShowUserActions(false);
    setAlertConfig({
      visible: true,
      title: selectedUser.isActive ? 'Deactivate User' : 'Activate User',
      message: `Are you sure you want to ${selectedUser.isActive ? 'deactivate' : 'activate'} ${selectedUser.name}?`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: selectedUser.isActive ? 'Deactivate' : 'Activate',
          style: selectedUser.isActive ? 'destructive' : 'default',
          onPress: () => {
            updateUser(selectedUser.id, { isActive: !selectedUser.isActive });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
    });
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleSaveUser = (userData: Omit<User, 'id' | 'createdAt'>) => {
    if (editingUser) {
      updateUser(editingUser.id, userData);
      setAlertConfig({
        visible: true,
        title: 'User Updated',
        message: `${userData.name} has been updated successfully.`,
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } else {
      addUser(userData);
      setAlertConfig({
        visible: true,
        title: 'User Created',
        message: `${userData.name} has been added successfully.`,
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  };

  const renderUserActionsAlert = () => (
    <ThemedAlert
      visible={showUserActions}
      title={selectedUser?.name || 'User Actions'}
      message="What would you like to do?"
      type="info"
      buttons={[
        {
          text: 'View Details',
          onPress: handleViewUser,
          style: 'default',
        },
        {
          text: 'Edit User',
          onPress: handleEditUser,
          style: 'default',
        },
        {
          text: selectedUser?.isActive ? 'Deactivate' : 'Activate',
          onPress: handleToggleStatus,
          style: selectedUser?.isActive ? 'destructive' : 'default',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]}
      onClose={() => setShowUserActions(false)}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales Reps</Text>
        <Text style={styles.count}>{filteredUsers.length} users</Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search users..."
        />
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterChip, filterActive === null && styles.filterChipActive]}
          onPress={() => setFilterActive(null)}
        >
          <Text style={[styles.filterChipText, filterActive === null && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterActive === true && styles.filterChipActive]}
          onPress={() => setFilterActive(true)}
        >
          <UserCheck size={16} color={filterActive === true ? Colors.light.primaryForeground : Colors.light.textSecondary} />
          <Text style={[styles.filterChipText, filterActive === true && styles.filterChipTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterActive === false && styles.filterChipActive]}
          onPress={() => setFilterActive(false)}
        >
          <UserX size={16} color={filterActive === false ? Colors.light.primaryForeground : Colors.light.textSecondary} />
          <Text style={[styles.filterChipText, filterActive === false && styles.filterChipTextActive]}>
            Inactive
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.userList}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <UserCard user={item} onPress={() => handleUserPress(item.id)} />
            <TouchableOpacity 
              style={styles.userEditBtn}
              onPress={() => {
                setEditingUser(item);
                setShowUserModal(true);
              }}
            >
              <Edit2 size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        }
      />

      <View style={styles.fab}>
        <Button
          title="Add User"
          onPress={handleAddUser}
          icon={<Plus size={20} color={Colors.light.primaryForeground} />}
        />
      </View>

      <UserFormModal
        visible={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />

      {renderUserActionsAlert()}

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
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  count: {
    fontSize: 14,
    color: Colors.light.textTertiary,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.light.primaryForeground,
  },
  userList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  userItem: {
    marginBottom: 12,
    position: 'relative',
  },
  userEditBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    left: 20,
  },
});
