import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Body, Button, Card, ErrorNotice, Heading } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { API_URL } from '@/lib/api';
import { registerForPush, unregisterPush } from '@/lib/notifications';
import { useSession } from '@/lib/session';
import { theme } from '@/lib/theme';

/** Profile, notification registration, privacy and sign-out. */
export function ProfileScreen() {
  const { viewer, signOut } = useSession();
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off'>('unknown');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Registration is attempted once on mount; the result decides what the
    // toggle shows, so the screen never claims a state it has not verified.
    void registerForPush().then((result) => {
      setPushState(result.ok ? 'on' : 'off');
      if (!result.ok) setNotice(result.reason);
    });
  }, []);

  async function togglePush() {
    setBusy(true);
    if (pushState === 'on') {
      await unregisterPush();
      setPushState('off');
      setNotice('This device will no longer receive notifications.');
    } else {
      const result = await registerForPush();
      setPushState(result.ok ? 'on' : 'off');
      setNotice(result.ok ? 'This device will receive notifications.' : result.reason);
    }
    setBusy(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.logo}>
        <Logo />
      </View>

      <Heading>{viewer?.displayName ?? 'Your profile'}</Heading>
      <Body muted>{viewer?.email}</Body>

      <View style={styles.badges}>
        {viewer?.roles.map((role) => (
          <Badge
            key={role}
            label={role.toLowerCase().replace(/_/g, ' ')}
            tone={role === 'USER' ? 'neutral' : 'gold'}
          />
        ))}
      </View>

      {notice ? <ErrorNotice message={notice} /> : null}

      <Card>
        <Heading level={3}>Notifications on this device</Heading>
        <Body muted>
          Notifications from this platform never say what a counselling session is about — only that
          you have one.
        </Body>
        <View style={styles.action}>
          <Button
            label={pushState === 'on' ? 'Turn off on this device' : 'Turn on for this device'}
            variant="secondary"
            onPress={togglePush}
            loading={busy}
          />
        </View>
      </Card>

      <Card>
        <Heading level={3}>Multi-factor authentication</Heading>
        <Body muted>
          {viewer?.mfaEnabled
            ? 'Enabled on your account.'
            : viewer?.mfaSetupRequired
              ? 'Required for your role and not yet set up. Sensitive actions stay blocked until you enrol.'
              : 'Not enabled. Adding a second factor means your password alone is not enough to reach your account.'}
        </Body>
        <View style={styles.action}>
          <Button
            label="Manage on the web"
            variant="secondary"
            onPress={() => Linking.openURL(`${API_URL}/app/privacy`)}
          />
        </View>
      </Card>

      <Card>
        <Heading level={3}>Privacy and your data</Heading>
        <Body muted>
          Download your data, manage who can find you, review every signed-in device, and submit a
          data-rights request.
        </Body>
        <View style={styles.action}>
          <Button
            label="Open the Privacy Centre"
            variant="secondary"
            onPress={() => Linking.openURL(`${API_URL}/app/privacy`)}
          />
        </View>
      </Card>

      <Card>
        <Heading level={3}>Help and safeguarding</Heading>
        <Body muted>
          Report a concern, or find out where to go for urgent help. This platform is not an
          emergency service.
        </Body>
        <View style={styles.action}>
          <Button
            label="Get help"
            variant="secondary"
            onPress={() => Linking.openURL(`${API_URL}/app/help`)}
          />
        </View>
      </Card>

      <View style={styles.signOut}>
        <Button
          label="Sign out"
          variant="danger"
          onPress={async () => {
            await unregisterPush();
            await signOut();
          }}
        />
      </View>

      <Body muted>
        Signing out clears the session stored in this device&apos;s keychain.
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.inkDeep },
  container: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
  logo: { marginBottom: theme.spacing(6) },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginVertical: theme.spacing(4),
  },
  action: { marginTop: theme.spacing(3) },
  signOut: { marginTop: theme.spacing(6), marginBottom: theme.spacing(3) },
});
