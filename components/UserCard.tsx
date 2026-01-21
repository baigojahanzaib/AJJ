import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Phone, Mail } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { User } from '@/types';
import Badge from './Badge';
import { DEFAULT_AVATARS, DEFAULT_AVATAR_KEYS } from '@/constants/avatars';

interface UserCardProps {
  user: User;
  onPress: () => void;
}

export default function UserCard({ user, onPress }: UserCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={
          user.avatar && DEFAULT_AVATARS[user.avatar]
            ? DEFAULT_AVATARS[user.avatar]
            : user.avatarUrl
              ? { uri: user.avatarUrl }
              : { uri: user.avatar || DEFAULT_AVATARS[DEFAULT_AVATAR_KEYS[Math.abs(user.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % DEFAULT_AVATAR_KEYS.length]] }
        }
        style={styles.avatar}
        contentFit="cover"
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{user.name}</Text>
          <Badge
            label={user.isActive ? 'Active' : 'Inactive'}
            variant={user.isActive ? 'success' : 'danger'}
            size="sm"
          />
        </View>
        <View style={styles.info}>
          <Mail size={14} color={Colors.light.textTertiary} />
          <Text style={styles.infoText}>{user.email}</Text>
        </View>
        <View style={styles.info}>
          <Phone size={14} color={Colors.light.textTertiary} />
          <Text style={styles.infoText}>{user.phone}</Text>
        </View>
      </View>
      <ChevronRight size={20} color={Colors.light.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.surfaceSecondary,
  },
  content: {
    flex: 1,
    marginLeft: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  infoText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
  },
});
