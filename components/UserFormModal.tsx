import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { X, Check, User as UserIcon, Camera } from 'lucide-react-native';
import Input from '@/components/Input';
import Button from '@/components/Button';
import ThemedAlert from '@/components/ThemedAlert';
import Colors from '@/constants/colors';
import { User, UserRole } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

interface UserFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (userData: Omit<User, 'id' | 'createdAt'>) => void;
  editingUser?: User | null;
}

import { DEFAULT_AVATARS, DEFAULT_AVATAR_KEYS } from '@/constants/avatars';

const sampleAvatars = DEFAULT_AVATAR_KEYS;

export default function UserFormModal({ visible, onClose, onSave, editingUser }: UserFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('sales_rep');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [localImageUri, setLocalImageUri] = useState<string | undefined>(undefined);
  const [isActive, setIsActive] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    buttons: [] as { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  });

  const isEditing = !!editingUser;

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email);
      setPhone(editingUser.phone);
      setRole(editingUser.role);
      setAvatar(editingUser.avatar);
      setLocalImageUri(undefined);
      setIsActive(editingUser.isActive);
      setPassword('');
      setConfirmPassword('');
    } else {
      resetForm();
    }
  }, [editingUser, visible]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setRole('sales_rep');
    setRole('sales_rep');
    setAvatar(undefined);
    setLocalImageUri(undefined);
    setIsActive(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Missing Name',
        message: 'Please enter the user\'s full name.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!email.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Missing Email',
        message: 'Please enter an email address.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!validateEmail(email)) {
      setAlertConfig({
        visible: true,
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!phone.trim()) {
      setAlertConfig({
        visible: true,
        title: 'Missing Phone',
        message: 'Please enter a phone number.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!isEditing && !password) {
      setAlertConfig({
        visible: true,
        title: 'Missing Password',
        message: 'Please enter a password for the new user.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!isEditing && password.length < 6) {
      setAlertConfig({
        visible: true,
        title: 'Weak Password',
        message: 'Password must be at least 6 characters long.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!isEditing && password !== confirmPassword) {
      setAlertConfig({
        visible: true,
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please try again.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (isEditing && password && password !== confirmPassword) {
      setAlertConfig({
        visible: true,
        title: 'Password Mismatch',
        message: 'Passwords do not match. Please try again.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }


    // Continue with upload logic inside handleSave
    setIsUploading(true);
    try {
      let finalAvatar = avatar;
      if (localImageUri) {
        const postUrl = await generateUploadUrl();
        const response = await fetch(localImageUri);
        const blob = await response.blob();

        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        });

        const { storageId } = await result.json();
        finalAvatar = storageId;
      }

      const userData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        isActive,
        ...(password && { password }),
      };
      const finalUserData = { ...userData, avatar: finalAvatar };
      onSave(finalUserData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } catch (error) {
      console.error("Error saving user:", error);
      setAlertConfig({
        visible: true,
        title: 'Error',
        message: 'Failed to save user. Please try again.',
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImagePick = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          setAlertConfig({
            visible: true,
            title: 'Permission Required',
            message: 'Camera permission is required to take photos.',
            type: 'warning',
            buttons: [{ text: 'OK', style: 'default' }],
          });
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0].uri) {
        setLocalImageUri(result.assets[0].uri);
        setAvatar(undefined); // Clear predefined avatar selection
        setShowAvatarPicker(false);
        Haptics.selectionAsync();
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const selectAvatar = (avatarUrl: string) => {
    setAvatar(avatarUrl);
    setLocalImageUri(undefined);
    setShowAvatarPicker(false);
    Haptics.selectionAsync();
  };

  const renderAvatarPicker = () => (
    <Modal
      visible={showAvatarPicker}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAvatarPicker(false)}
    >
      <SafeAreaView style={styles.avatarPickerContainer} edges={['top', 'bottom']}>
        <View style={styles.avatarPickerHeader}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAvatarPicker(false)}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Choose Avatar</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.avatarPickerContent} showsVerticalScrollIndicator={false}>
          <View style={styles.imageSourceOptions}>
            <TouchableOpacity style={styles.sourceOption} onPress={() => handleImagePick('library')}>
              <View style={styles.sourceIconContainer}>
                <Image source={require('@/assets/images/profiles/avatar_1.jpg')} style={{ width: 24, height: 24, opacity: 0 }} />
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Camera size={24} color={Colors.light.primary} />
                </View>
              </View>
              <Text style={styles.sourceText}>Choose Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceOption} onPress={() => handleImagePick('camera')}>
              <View style={styles.sourceIconContainer}>
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Camera size={24} color={Colors.light.primary} />
                </View>
              </View>
              <Text style={styles.sourceText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.avatarPickerSubtitle}>Or choose a default avatar</Text>
          <View style={styles.avatarGrid}>
            {sampleAvatars.map((url, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.avatarOption,
                  avatar === url && styles.avatarOptionSelected,
                ]}
                onPress={() => selectAvatar(url)}
              >
                <Image
                  source={DEFAULT_AVATARS[url] ? DEFAULT_AVATARS[url] : { uri: url }}
                  style={styles.avatarOptionImg}
                  contentFit="cover"
                />
                {avatar === url && (
                  <View style={styles.avatarSelectedOverlay}>
                    <Check size={24} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {avatar && (
            <TouchableOpacity
              style={styles.removeAvatarBtn}
              onPress={() => {
                setAvatar(undefined);
                setLocalImageUri(undefined);
                setShowAvatarPicker(false);
                Haptics.selectionAsync();
              }}
            >
              <Text style={styles.removeAvatarText}>Remove Avatar</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal >
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEditing ? 'Edit User' : 'Add User'}
          </Text>
          <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
            <Check size={24} color={Colors.light.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => setShowAvatarPicker(true)}
            >
              {(localImageUri || avatar) ? (
                <Image
                  source={
                    localImageUri
                      ? { uri: localImageUri }
                      : (avatar && DEFAULT_AVATARS[avatar])
                        ? DEFAULT_AVATARS[avatar]
                        : (avatar === editingUser?.avatar && editingUser?.avatarUrl)
                          ? { uri: editingUser.avatarUrl }
                          : { uri: avatar }
                  }
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <UserIcon size={40} color={Colors.light.textTertiary} />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Camera size={14} color={Colors.light.primaryForeground} />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <Input
              label="Full Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Email Address"
              placeholder="email@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              containerStyle={styles.inputContainer}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Role</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'sales_rep' && styles.roleOptionActive]}
                onPress={() => {
                  setRole('sales_rep');
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.roleOptionText, role === 'sales_rep' && styles.roleOptionTextActive]}>
                  Sales Rep
                </Text>
                <Text style={[styles.roleOptionSubtext, role === 'sales_rep' && styles.roleOptionSubtextActive]}>
                  Can create orders & manage customers
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'admin' && styles.roleOptionActive]}
                onPress={() => {
                  setRole('admin');
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.roleOptionText, role === 'admin' && styles.roleOptionTextActive]}>
                  Admin
                </Text>
                <Text style={[styles.roleOptionSubtext, role === 'admin' && styles.roleOptionSubtextActive]}>
                  Full access to all features
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isEditing ? 'Change Password (Optional)' : 'Password'}
            </Text>
            <Input
              label="Password"
              placeholder={isEditing ? 'Leave blank to keep current' : 'Enter password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Confirm Password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              containerStyle={styles.inputContainer}
            />
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.activeToggle}
              onPress={() => {
                setIsActive(!isActive);
                Haptics.selectionAsync();
              }}
            >
              <View>
                <Text style={styles.activeToggleLabel}>Active User</Text>
                <Text style={styles.activeToggleSubtext}>
                  User can log in and use the app
                </Text>
              </View>
              <View style={[styles.toggle, isActive && styles.toggleActive]}>
                <View style={[styles.toggleKnob, isActive && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.saveSection}>
            <Button
              title={isUploading ? "Uploading..." : (isEditing ? "Update User" : "Create User")}
              onPress={handleSave}
              fullWidth
              size="lg"
              disabled={isUploading}
              icon={isUploading ? undefined : <Check size={20} color={Colors.light.primaryForeground} />}
            />
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        {renderAvatarPicker()}

        <ThemedAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
        />
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.light.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.light.background,
  },
  avatarHint: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  roleContainer: {
    gap: 10,
  },
  roleOption: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  roleOptionActive: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  roleOptionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  roleOptionTextActive: {
    color: Colors.light.primary,
  },
  roleOptionSubtext: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  roleOptionSubtextActive: {
    color: Colors.light.textSecondary,
  },
  activeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  activeToggleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  activeToggleSubtext: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.surfaceSecondary,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.light.primary,
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  saveSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
  avatarPickerContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  avatarPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.borderLight,
    backgroundColor: Colors.light.surface,
  },
  avatarPickerContent: {
    flex: 1,
  },
  avatarPickerSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  avatarOption: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: Colors.light.primary,
  },
  avatarOptionImg: {
    width: '100%',
    height: '100%',
  },
  avatarSelectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAvatarBtn: {
    alignSelf: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.light.dangerLight,
    borderRadius: 10,
  },
  removeAvatarText: {
    color: Colors.light.danger,
  },
  imageSourceOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 20,
  },
  sourceOption: {
    alignItems: 'center',
    gap: 8,
  },
  sourceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
});
