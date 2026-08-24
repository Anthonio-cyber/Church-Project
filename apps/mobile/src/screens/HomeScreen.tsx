import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Body, Button, Card, EmptyState, ErrorNotice, Heading, Loading, SafeguardingNotice } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { theme } from '@/lib/theme';

type SessionSummary = {
  id: string;
  scheduledFor: string;
  status: string;
  categoryLabel: string;
  viewerRole: string;
  counterpart: { displayName: string; role: string };
  waitingRoom: { canEnterWaitingRoom: boolean; canEnterSession: boolean; label: string; detail: string };
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The personalised home screen: the next session first, then the things people come for. */
export function HomeScreen({ navigate }: { navigate: (tab: string) => void }) {
  const { viewer } = useSession();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<{ sessions: SessionSummary[] }>('/api/counselling/sessions');
      setSessions(data.sessions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not load your dashboard.');
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const next = sessions?.[0];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={theme.colors.gold}
        />
      }
    >
      <Heading>
        {greeting()}, {viewer?.firstName ?? 'friend'}
      </Heading>
      <Body muted>How can we serve you today?</Body>

      {error ? <ErrorNotice message={error} /> : null}

      {viewer?.mfaSetupRequired ? (
        <Card style={styles.warningCard}>
          <Heading level={3}>Multi-factor authentication is required</Heading>
          <Body>
            Your role requires a second factor. Sensitive actions stay blocked until you set it up
            from Privacy &amp; Security on the web application.
          </Body>
        </Card>
      ) : null}

      {sessions === null ? (
        <Loading label="Loading your dashboard" />
      ) : next ? (
        <Card style={styles.sessionCard}>
          <Badge
            label={next.waitingRoom.canEnterSession ? 'Ready to join' : next.waitingRoom.label}
            tone={next.waitingRoom.canEnterSession ? 'success' : 'gold'}
          />
          <View style={styles.sessionBody}>
            <Heading level={2}>
              {new Date(next.scheduledFor).toLocaleString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Heading>
            <Body muted>
              {next.categoryLabel} · with {next.counterpart.displayName}
            </Body>
            <Body>{next.waitingRoom.detail}</Body>
          </View>
          <Button
            label={
              next.waitingRoom.canEnterSession
                ? 'Enter Secure Session'
                : next.waitingRoom.canEnterWaitingRoom
                  ? 'Enter Waiting Room'
                  : 'View session'
            }
            onPress={() => navigate('Counselling')}
          />
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Card>
          <Heading level={3}>Private Counselling</Heading>
          <Body muted>Speak privately with an approved counsellor.</Body>
          <View style={styles.actionButton}>
            <Button label="Open counselling" onPress={() => navigate('Counselling')} variant="secondary" />
          </View>
        </Card>

        <Card>
          <Heading level={3}>Request Prayer</Heading>
          <Body muted>Publicly, privately, or with the ministry team.</Body>
          <View style={styles.actionButton}>
            <Button label="Open prayer" onPress={() => navigate('Learn')} variant="secondary" />
          </View>
        </Card>

        <Card>
          <Heading level={3}>Continue Learning</Heading>
          <Body muted>Pick up your discipleship course where you left off.</Body>
          <View style={styles.actionButton}>
            <Button label="Open discipleship" onPress={() => navigate('Learn')} variant="secondary" />
          </View>
        </Card>
      </View>

      {sessions?.length === 0 && !error ? (
        <EmptyState
          title="No sessions scheduled"
          body="When you request counselling and a counsellor accepts, your session appears here with a route into the waiting room."
        />
      ) : null}

      <SafeguardingNotice />

      <Text style={styles.footer}>
        Signed in as {viewer?.email}. Your counselling information is protected by encryption and
        recorded access.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.inkDeep },
  container: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
  sessionCard: {
    borderColor: theme.colors.gold,
    borderWidth: 2,
    marginTop: theme.spacing(5),
  },
  sessionBody: { marginVertical: theme.spacing(3), gap: theme.spacing(1) },
  warningCard: { borderColor: '#92400e', backgroundColor: '#451a03', marginTop: theme.spacing(4) },
  actions: { marginTop: theme.spacing(5) },
  actionButton: { marginTop: theme.spacing(3) },
  footer: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: theme.spacing(4),
  },
});
