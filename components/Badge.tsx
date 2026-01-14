import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export default function Badge({
  label,
  variant = 'default',
  size = 'md',
  style,
}: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return { bg: Colors.light.successLight, text: Colors.light.successForeground };
      case 'warning':
        return { bg: Colors.light.warningLight, text: Colors.light.warningForeground };
      case 'danger':
        return { bg: Colors.light.dangerLight, text: Colors.light.dangerForeground };
      case 'info':
        return { bg: Colors.light.infoLight, text: Colors.light.infoForeground };
      default:
        return { bg: Colors.light.surfaceSecondary, text: Colors.light.textSecondary };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View
      style={[
        styles.base,
        styles[`size_${size}`],
        { backgroundColor: variantStyles.bg },
        style,
      ]}
    >
      <Text style={[styles.text, styles[`text_${size}`], { color: variantStyles.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  size_sm: {
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  size_md: {
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  text: {
    fontWeight: '600' as const,
  },
  text_sm: {
    fontSize: 11,
  },
  text_md: {
    fontSize: 13,
  },
});
