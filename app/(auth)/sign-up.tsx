import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Phone, User, Lock, ShoppingBag } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Colors from '@/constants/colors';

export default function ClientSignUpScreen() {
  const router = useRouter();
  const { signUpClient } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsLoading(true);
    const result = await signUpClient({ name, email, phone, password });
    setIsLoading(false);

    if (result.success) {
      router.replace('/(shop)/checkout' as any);
      return;
    }

    setError(result.error || 'Could not create account');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <ShoppingBag size={36} color={Colors.light.primary} />
            </View>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Order faster and track your history</Text>
          </View>

          <Input
            label="Full Name"
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            leftIcon={<User size={20} color={Colors.light.textTertiary} />}
          />
          <Input
            label="Email"
            placeholder="client@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={20} color={Colors.light.textTertiary} />}
          />
          <Input
            label="Phone"
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon={<Phone size={20} color={Colors.light.textTertiary} />}
          />
          <Input
            label="Password"
            placeholder="Minimum 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={<Lock size={20} color={Colors.light.textTertiary} />}
          />
          <Input
            label="Confirm Password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            leftIcon={<Lock size={20} color={Colors.light.textTertiary} />}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Create Account"
            onPress={handleCreateAccount}
            loading={isLoading}
            fullWidth
            size="lg"
          />
          <Button
            title="Already have an account"
            onPress={() => router.replace('/(auth)/sign-in' as any)}
            variant="ghost"
            fullWidth
            style={styles.secondaryAction}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  error: {
    color: Colors.light.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryAction: {
    marginTop: 8,
  },
});
