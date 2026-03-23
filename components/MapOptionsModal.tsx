import { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ExternalLink, MapPinned, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { buildMapLinkOptions, formatMapPreview } from '@/lib/map-links';

interface MapOptionsModalProps {
  visible: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  label?: string;
  onClose: () => void;
  onOpenError?: (platformLabel: string) => void;
}

export default function MapOptionsModal({
  visible,
  address,
  latitude,
  longitude,
  label = 'Location',
  onClose,
  onOpenError,
}: MapOptionsModalProps) {
  const options = useMemo(
    () => buildMapLinkOptions({ address, latitude, longitude, label }),
    [address, label, latitude, longitude]
  );
  const preview = useMemo(
    () => formatMapPreview({ address, latitude, longitude, label }),
    [address, label, latitude, longitude]
  );

  const handleOpen = async (platformLabel: string, url: string) => {
    try {
      await Linking.openURL(url);
      onClose();
    } catch (error) {
      console.error('[Maps] Failed to open map URL:', error);
      onOpenError?.(platformLabel);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(event) => event.stopPropagation()}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color={Colors.light.textTertiary} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <MapPinned size={28} color={Colors.light.primary} />
          </View>

          <Text style={styles.title}>Open In Maps</Text>
          {!!preview && <Text style={styles.preview}>{preview}</Text>}

          <View style={styles.optionList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionButton}
                onPress={() => handleOpen(option.label, option.url)}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
                <ExternalLink size={16} color={Colors.light.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.light.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    textAlign: 'center',
  },
  preview: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  optionList: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.light.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceSecondary,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
});
