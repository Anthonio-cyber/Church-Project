import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Body, Button, ErrorNotice, Heading } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { useSession } from '@/lib/session';
import { theme } from '@/lib/theme';

/**
 * Sign in.
 *
 * Two-step, exactly as on the web: when the server answers `mfa_required`, no
 * session exists yet — the password check passed and nothing more. Biometric
 * unlock is offered only to re-open an existing stored session, never as a
 * substitute for the password on a fresh sign-in.
 */
export function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [stage, setStage] = useState<'credentials' | 'mfa'>('credentials');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);

    try {
      const result = await signIn(email, password, stage === 'mfa' ? mfaCode : undefined);
      if (result === 'mfa_required') setStage('mfa');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Sign-in failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function biometricUnlock() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !enrolled) {
      setError('This device has no biometric unlock set up.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock iPastor',
      fallbackLabel: 'Use your password',
    });

    if (!result.success) setError('Biometric unlock was not completed.');
    // On success the stored session is already valid; the session provider
    // picks it up on the next refresh.
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Logo size="lg" />
        </View>

        <Heading>Welcome back</Heading>
        <Body muted>Sign in to your account to continue.</Body>

        <View style={styles.form}>
          {error ? <ErrorNotice message={error} /> : null}

          {stage === 'credentials' ? (
            <>
              <Text style={styles.label} nativeID="emailLabel">
                Email address
              </Text>
              <TextInput
                accessibilityLabelledBy="emailLabel"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholderTextColor={theme.colors.muted}
              />

              <Text style={styles.label} nativeID="passwordLabel">
                Password
              </Text>
              <TextInput
                accessibilityLabelledBy="passwordLabel"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
              />
            </>
          ) : (
            <>
              <Text style={styles.label} nativeID="mfaLabel">
                Six-digit authentication code
              </Text>
              <TextInput
                accessibilityLabelledBy="mfaLabel"
                style={[styles.input, styles.codeInput]}
                value={mfaCode}
                onChangeText={(value) => setMfaCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
              />
              <Body muted>
                Open your authenticator app and enter the current code for this account.
              </Body>
            </>
          )}

          <View style={styles.actions}>
            <Button
              label={stage === 'mfa' ? 'Verify and sign in' : 'Sign in'}
              onPress={submit}
              loading={busy}
              disabled={
                stage === 'credentials' ? !email || !password : mfaCode.length !== 6
              }
            />

            {stage === 'credentials' ? (
              <Button label="Unlock with biometrics" onPress={biometricUnlock} variant="secondary" />
            ) : (
              <Button
                label="Use a different account"
                onPress={() => {
                  setStage('credentials');
                  setMfaCode('');
                  setError(null);
                }}
                variant="secondary"
              />
            )}
          </View>
        </View>

        <Body muted>
          Counsellors, moderators and administrators are required to use multi-factor
          authentication.
        </Body>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.inkDeep },
  container: { padding: theme.spacing(6), paddingTop: theme.spacing(16), gap: theme.spacing(2) },
  logo: { alignItems: 'center', marginBottom: theme.spacing(8) },
  form: { marginTop: theme.spacing(6), gap: theme.spacing(2) },
  label: {
    color: theme.colors.parchmentSoft,
    fontSize: 14,
    fontWeight: '600',
    marginTop: theme.spacing(3),
  },
  input: {
    backgroundColor: theme.colors.ink,
    borderWidth: 1,
    borderColor: theme.colors.inkBorder,
    borderRadius: theme.radius.md,
    color: theme.colors.parchment,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: theme.spacing(3.5),
  },
  codeInput: { fontSize: 26, letterSpacing: 10, textAlign: 'center' },
  actions: { marginTop: theme.spacing(6), gap: theme.spacing(3) },
});
