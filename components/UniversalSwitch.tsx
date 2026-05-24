import { Host, Switch as ExpoUISwitch } from '@expo/ui';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface UniversalSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  testID?: string;
  style?: ViewStyle;
  trackColor?: unknown;
  thumbColor?: string;
}

export default function UniversalSwitch({
  value,
  onValueChange,
  disabled,
  label,
  testID,
  style,
}: UniversalSwitchProps) {
  return (
    <View style={style}>
      <Host matchContents style={styles.host}>
        <ExpoUISwitch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          label={label}
          testID={testID}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    minWidth: 56,
  },
});
