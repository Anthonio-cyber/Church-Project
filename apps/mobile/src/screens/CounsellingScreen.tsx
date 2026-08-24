import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  Badge,
  Body,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Heading,
  Loading,
  SafeguardingNotice,
} from '@/components/ui';
import { api, API_URL } from '@/lib/api';
import { theme } from '@/lib/theme';
import { Linking } from 'react-native';

type CounsellingSession = {
  id: string;
  scheduledFor: string;
  durationMinutes: number;
  status: string;
  categoryLabel: string;
  summary: string;
  viewerRole: string;
  counterpart: { displayName: string; role: string };
  waitingRoom: {
    canEnterWaitingRoom: boolean;
    canEnterSession: boolean;
    label: string;
    detail: string;
  };
};

/**
 * Counselling on mobile.
 *
 * The list, the waiting-room state and joining are native. The live session
 * itself opens the secure web session view in the device browser, which keeps
 * exactly one implementation of the conversation surface, its privacy notices
 * and its realtime handling — rather than a second one that could drift from
 * the first.
 */
export function CounsellingScreen() {
  const [sessions, setSessions] = useState<CounsellingSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api<{ sessions: CounsellingSession[] }>('/api/counselling/sessions');
      setSessions(data.sessions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not load your sessions.');
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(session: CounsellingSession) {
    setBusyId(session.id);
    setError(null);
    try {
      await api(`/api/counselling/sessions/${session.id}/join`, { method: 'POST' });
      await load();
      await Linking.openURL(`${API_URL}/app/counselling/${session.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not connect you.');
    } finally {
      setBusyId(null);
    }
  }

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
      <Heading>Counselling</Heading>
      <Body muted>Your requests, sessions and the private waiting room.</Body>

      {error ? <ErrorNotice message={error} /> : null}

      <View style={styles.notice}>
        <SafeguardingNotice />
      </View>

      {sessions === null ? (
        <Loading label="Loading your sessions" />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No counselling sessions yet"
          body="Request pastoral counselling from the web application and the counselling team will match you with an approved counsellor. Your session will appear here."
        />
      ) : (
        sessions.map((session) => (
          <Card key={session.id}>
            <View style={styles.badgeRow}>
              <Badge label={session.categoryLabel} tone="gold" />
              <Badge
                label={session.waitingRoom.label}
                tone={session.waitingRoom.canEnterSession ? 'success' : 'neutral'}
              />
            </View>

            <Heading level={3}>
              {new Date(session.scheduledFor).toLocaleString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Heading>

            <Body muted>
              {session.viewerRole === 'counsellor' ? 'With ' : 'With '}
              {session.counterpart.displayName} · {session.counterpart.role} ·{' '}
              {session.durationMinutes} minutes
            </Body>

            <Body>{session.waitingRoom.detail}</Body>

            {session.waitingRoom.canEnterWaitingRoom ? (
              <View style={styles.action}>
                <Button
                  label={
                    session.waitingRoom.canEnterSession
                      ? 'Enter Secure Session'
                      : 'Enter Private Waiting Room'
                  }
                  onPress={() => join(session)}
                  loading={busyId === session.id}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}

      <Card>
        <Heading level={3}>What stays private</Heading>
        <Body muted>
          Your session is visible to you and your assigned counsellor. A safeguarding lead may reach
          counselling records where there is a safeguarding concern, only with a written reason, and
          that access is recorded permanently. Administrators do not see your conversation by virtue
          of rank.
        </Body>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.inkDeep },
  container: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
  notice: { marginVertical: theme.spacing(4) },
  badgeRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  action: { marginTop: theme.spacing(4) },
});
