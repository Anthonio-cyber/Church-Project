import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { theme } from '@/lib/theme';

/** The shared mobile interface kit, matching the web application's identity. */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children, level = 1 }: { children: ReactNode; level?: 1 | 2 | 3 }) {
  return (
    <Text
      accessibilityRole="header"
      style={level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3}
    >
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.bodyMuted]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.ink : theme.colors.gold} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' ? styles.buttonLabelPrimary : styles.buttonLabelSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'gold' | 'success' | 'warning' | 'danger';
}) {
  const toneStyle =
    tone === 'gold'
      ? styles.badgeGold
      : tone === 'success'
        ? styles.badgeSuccess
        : tone === 'warning'
          ? styles.badgeWarning
          : tone === 'danger'
            ? styles.badgeDanger
            : styles.badgeNeutral;

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyMark}>✦</Text>
      <Heading level={3}>{title}</Heading>
      <Body muted>{body}</Body>
    </View>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.gold} size="large" />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

/** The safeguarding notice, repeated wherever counselling is offered. */
export function SafeguardingNotice() {
  return (
    <View style={styles.safeguarding}>
      <Text style={styles.safeguardingText}>
        <Text style={styles.safeguardingStrong}>Not an emergency service. </Text>
        Online pastoral counselling is not a substitute for emergency, medical, psychological,
        psychiatric or legal services. If you are in immediate danger, contact appropriate local
        emergency or professional services.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.inkSoft,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.inkBorder,
    padding: theme.spacing(4),
    marginBottom: theme.spacing(3),
  },
  h1: {
    color: theme.colors.parchment,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: theme.spacing(2),
  },
  h2: {
    color: theme.colors.parchment,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: theme.spacing(2),
  },
  h3: {
    color: theme.colors.parchment,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.spacing(1),
  },
  body: { color: theme.colors.parchmentSoft, fontSize: 15, lineHeight: 22 },
  bodyMuted: { color: theme.colors.muted },
  button: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing(5),
  },
  buttonPrimary: { backgroundColor: theme.colors.gold },
  buttonSecondary: { borderWidth: 1, borderColor: theme.colors.inkBorder },
  buttonDanger: { backgroundColor: theme.colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  buttonLabelPrimary: { color: theme.colors.inkDeep },
  buttonLabelSecondary: { color: theme.colors.parchment },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(1),
    alignSelf: 'flex-start',
  },
  badgeNeutral: { backgroundColor: theme.colors.inkBorder },
  badgeGold: { backgroundColor: theme.colors.goldDark },
  badgeSuccess: { backgroundColor: '#065f46' },
  badgeWarning: { backgroundColor: '#92400e' },
  badgeDanger: { backgroundColor: '#991b1b' },
  badgeLabel: { color: theme.colors.parchment, fontSize: 11, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing(12),
    paddingHorizontal: theme.spacing(6),
  },
  emptyMark: { color: theme.colors.gold, fontSize: 32, marginBottom: theme.spacing(3) },
  error: {
    backgroundColor: '#450a0a',
    borderColor: '#991b1b',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  errorText: { color: '#fecaca', fontSize: 14, lineHeight: 20 },
  loading: { paddingVertical: theme.spacing(12), alignItems: 'center', gap: theme.spacing(3) },
  loadingLabel: { color: theme.colors.muted, fontSize: 14 },
  safeguarding: {
    backgroundColor: '#451a03',
    borderColor: '#92400e',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(3.5),
    marginBottom: theme.spacing(3),
  },
  safeguardingText: { color: '#fde68a', fontSize: 13, lineHeight: 19 },
  safeguardingStrong: { fontWeight: '700' },
});
