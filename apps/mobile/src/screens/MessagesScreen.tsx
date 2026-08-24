import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Body, Button, Card, EmptyState, ErrorNotice, Heading, Loading } from '@/components/ui';
import { api, API_URL } from '@/lib/api';
import { theme } from '@/lib/theme';

type Conversation = {
  id: string;
  kind: string;
  participants: { id: string; displayName: string }[];
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unread: boolean;
  lastMessageAt: string | null;
};

type ConnectionEntry = {
  id: string;
  person: { displayName: string };
  introMessage: string | null;
};

/** Messages and pending connection requests. */
export function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [pending, setPending] = useState<ConnectionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [threads, connections] = await Promise.all([
        api<{ conversations: Conversation[] }>('/api/messages/conversations'),
        api<{ pendingIncoming: ConnectionEntry[] }>('/api/connections'),
      ]);
      setConversations(threads.conversations);
      setPending(connections.pendingIncoming);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not load your messages.');
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: string, action: 'accept' | 'decline') {
    setBusyId(id);
    try {
      await api(`/api/connections/${id}/${action}`, {
        method: 'POST',
        ...(action === 'decline' ? { body: { block: false } } : {}),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That action failed.');
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
      <Heading>Messages</Heading>
      <Body muted>
        Nobody can start a private conversation with you unless you accept their request.
      </Body>

      {error ? <ErrorNotice message={error} /> : null}

      {pending.length > 0 ? (
        <View style={styles.section}>
          <Heading level={2}>Requests awaiting your decision</Heading>
          {pending.map((entry) => (
            <Card key={entry.id} style={styles.pendingCard}>
              <Heading level={3}>{entry.person.displayName}</Heading>
              {entry.introMessage ? (
                <Body>“{entry.introMessage}”</Body>
              ) : (
                <Body muted>They did not include a message.</Body>
              )}
              <View style={styles.actions}>
                <Button
                  label="Accept"
                  onPress={() => respond(entry.id, 'accept')}
                  loading={busyId === entry.id}
                />
                <Button
                  label="Decline"
                  onPress={() => respond(entry.id, 'decline')}
                  variant="secondary"
                />
              </View>
              <Body muted>Declining is not announced to them.</Body>
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Heading level={2}>Conversations</Heading>

        {conversations === null ? (
          <Loading label="Loading conversations" />
        ) : conversations.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            body="A conversation exists only after both people have agreed to connect."
          />
        ) : (
          conversations.map((conversation) => (
            <Card key={conversation.id}>
              <View style={styles.threadHeader}>
                <Heading level={3}>
                  {conversation.participants[0]?.displayName ?? 'Member'}
                </Heading>
                {conversation.unread ? <Badge label="New" tone="gold" /> : null}
              </View>
              <Body muted>{conversation.lastMessage?.body ?? 'No messages yet'}</Body>
              <View style={styles.action}>
                <Button
                  label="Open conversation"
                  variant="secondary"
                  onPress={() => Linking.openURL(`${API_URL}/app/messages/${conversation.id}`)}
                />
              </View>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.inkDeep },
  container: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
  section: { marginTop: theme.spacing(6) },
  pendingCard: { borderColor: theme.colors.goldDark },
  threadHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  actions: { flexDirection: 'row', gap: theme.spacing(3), marginTop: theme.spacing(4) },
  action: { marginTop: theme.spacing(3) },
});
