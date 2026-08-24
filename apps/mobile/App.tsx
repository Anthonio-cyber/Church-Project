import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

import { api, clearToken, storeToken } from '@/lib/api';
import { SessionContext, type Viewer } from '@/lib/session';
import { Loading } from '@/components/ui';
import { theme } from '@/lib/theme';
import { SignInScreen } from '@/screens/SignInScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { CounsellingScreen } from '@/screens/CounsellingScreen';
import { MessagesScreen } from '@/screens/MessagesScreen';
import { LearnScreen } from '@/screens/LearnScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const TABS = [
  { key: 'Home', label: 'Home', icon: '⌂' },
  { key: 'Counselling', label: 'Counselling', icon: '✚' },
  { key: 'Messages', label: 'Messages', icon: '✉' },
  { key: 'Learn', label: 'Learn', icon: '📖' },
  { key: 'Profile', label: 'Profile', icon: '☺' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * 𝒾Pastor — the Android, iOS and tablet application.
 *
 * The same backend, the same accounts, the same permissions and the same audit
 * trail as the web application. The five tabs are the five things people
 * actually open the app for.
 */
export default function App() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('Home');

  const refresh = useCallback(async () => {
    try {
      const data = await api<{
        user: { id: string; email: string; mfaEnabled: boolean; mfaRequired: boolean };
        profile: { displayName: string; firstName: string } | null;
        roles: string[];
        permissions: string[];
        unreadNotifications: number;
      }>('/api/me');

      setViewer({
        id: data.user.id,
        email: data.user.email,
        displayName: data.profile?.displayName ?? 'Member',
        firstName: data.profile?.firstName ?? 'friend',
        roles: data.roles,
        permissions: data.permissions,
        mfaEnabled: data.user.mfaEnabled,
        mfaSetupRequired: data.user.mfaRequired && !data.user.mfaEnabled,
        unreadNotifications: data.unreadNotifications,
      });
    } catch {
      // A rejected or absent session simply means signed out.
      setViewer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      const data = await api<{
        mfaRequired: boolean;
        sessionToken?: string;
      }>('/api/auth/login', {
        method: 'POST',
        authenticated: false,
        body: {
          email,
          password,
          ...(mfaCode ? { mfaCode } : {}),
          deviceLabel: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} app`,
        },
      });

      if (data.mfaRequired) return 'mfa_required' as const;
      if (data.sessionToken) await storeToken(data.sessionToken);
      await refresh();
      return 'ok' as const;
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await clearToken();
    setViewer(null);
    setTab('Home');
  }, []);

  const session = useMemo(
    () => ({ viewer, loading, signIn, signOut, refresh }),
    [viewer, loading, signIn, signOut, refresh],
  );

  return (
    <SafeAreaProvider>
      <SessionContext.Provider value={session}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          {loading ? (
            <Loading label="Opening iPastor" />
          ) : !viewer ? (
            <SignInScreen />
          ) : (
            <View style={styles.flex}>
              <View style={styles.flex}>
                {tab === 'Home' ? <HomeScreen navigate={(next) => setTab(next as TabKey)} /> : null}
                {tab === 'Counselling' ? <CounsellingScreen /> : null}
                {tab === 'Messages' ? <MessagesScreen /> : null}
                {tab === 'Learn' ? <LearnScreen /> : null}
                {tab === 'Profile' ? <ProfileScreen /> : null}
              </View>

              <SafeAreaView edges={['bottom']} style={styles.tabBarWrapper}>
                <View style={styles.tabBar} accessibilityRole="tablist">
                  {TABS.map((entry) => {
                    const active = tab === entry.key;
                    return (
                      <Text
                        key={entry.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={entry.label}
                        onPress={() => setTab(entry.key)}
                        style={[styles.tab, active && styles.tabActive]}
                      >
                        {entry.icon}
                        {'\n'}
                        <Text style={styles.tabLabel}>{entry.label}</Text>
                      </Text>
                    );
                  })}
                </View>
              </SafeAreaView>
            </View>
          )}
        </SafeAreaView>
      </SessionContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.inkDeep },
  flex: { flex: 1 },
  tabBarWrapper: { backgroundColor: theme.colors.ink },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.inkBorder,
    backgroundColor: theme.colors.ink,
  },
  tab: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.muted,
    fontSize: 18,
    paddingVertical: theme.spacing(2.5),
    minHeight: 56,
  },
  tabActive: { color: theme.colors.goldLight },
  tabLabel: { fontSize: 11, fontWeight: '600' },
});
