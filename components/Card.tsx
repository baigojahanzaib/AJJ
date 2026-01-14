import { StyleSheet, View, ViewStyle, TouchableOpacity } from 'react-native';
import Colors from '@/constants/colors';
import React from "react";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'elevated' | 'outlined' | 'filled';
}

export default function Card({
  children,
  style,
  onPress,
  padding = 'md',
  variant = 'elevated',
}: CardProps) {
  const cardStyles: ViewStyle[] = [
    styles.base,
    styles[`padding_${padding}`],
    styles[variant],
    style as ViewStyle,
  ].filter(Boolean);

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyles} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: 12,
  },
  padding_md: {
    padding: 16,
  },
  padding_lg: {
    padding: 20,
  },
  elevated: {
    backgroundColor: Colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  outlined: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filled: {
    backgroundColor: Colors.light.surfaceSecondary,
  },
});
