import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Badge, Body, Button, Card, EmptyState, ErrorNotice, Heading, Loading } from '@/components/ui';
import { api, API_URL } from '@/lib/api';
import { theme } from '@/lib/theme';

type Course = {
  id: string;
  slug: string;
  title: string;
  track: string;
  summary: string;
  lessonCount: number;
  progress: { percentComplete: number; completedAt: string | null } | null;
};

type Prayer = {
  id: string;
  title: string;
  body: string;
  prayerCount: number;
  hasPrayed: boolean;
  isMine: boolean;
  author: { displayName: string };
};

/** Discipleship courses and the prayer wall. */
export function LearnScreen() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [courseData, prayerData] = await Promise.all([
        api<{ courses: Course[] }>('/api/courses'),
        api<{ prayers: Prayer[] }>('/api/prayers?scope=public&take=10'),
      ]);
      setCourses(courseData.courses);
      setPrayers(prayerData.prayers);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not load this page.');
      setCourses([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pray(id: string) {
    setPrayers((current) =>
      current.map((prayer) =>
        prayer.id === id
          ? { ...prayer, hasPrayed: true, prayerCount: prayer.prayerCount + 1 }
          : prayer,
      ),
    );
    try {
      await api(`/api/prayers/${id}/pray`, { method: 'POST' });
    } catch {
      await load();
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
      <Heading>Learn and pray</Heading>
      <Body muted>Discipleship courses, and the prayer wall.</Body>

      {error ? <ErrorNotice message={error} /> : null}

      <View style={styles.section}>
        <Heading level={2}>Discipleship</Heading>

        {courses === null ? (
          <Loading label="Loading courses" />
        ) : courses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            body="Courses appear here once the content team publishes them."
          />
        ) : (
          courses.map((course) => (
            <Card key={course.id}>
              <Badge label={course.track} tone="gold" />
              <View style={styles.courseBody}>
                <Heading level={3}>{course.title}</Heading>
                <Body muted>{course.summary}</Body>
              </View>

              {course.progress ? (
                <View>
                  <Body muted>{course.progress.percentComplete}% complete</Body>
                  <View style={styles.progressTrack}>
                    <View
                      style={[styles.progressFill, { width: `${course.progress.percentComplete}%` }]}
                    />
                  </View>
                </View>
              ) : (
                <Body muted>
                  {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
                </Body>
              )}

              <View style={styles.action}>
                <Button
                  label={course.progress ? 'Continue' : 'Start course'}
                  variant="secondary"
                  onPress={() => Linking.openURL(`${API_URL}/app/discipleship/${course.slug}`)}
                />
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Heading level={2}>Prayer wall</Heading>

        {prayers.length === 0 ? (
          <EmptyState
            title="The prayer wall is quiet"
            body="When members share requests publicly, they appear here for the fellowship to pray over."
          />
        ) : (
          prayers.map((prayer) => (
            <Card key={prayer.id}>
              <Heading level={3}>{prayer.title}</Heading>
              <Body>{prayer.body}</Body>
              <Body muted>{prayer.author.displayName}</Body>

              <View style={styles.prayRow}>
                <Button
                  label={prayer.hasPrayed ? '✓ Praying' : 'Pray for this'}
                  variant={prayer.hasPrayed ? 'secondary' : 'primary'}
                  onPress={() => pray(prayer.id)}
                  disabled={prayer.hasPrayed}
                />
                <Body muted>
                  {prayer.prayerCount} {prayer.prayerCount === 1 ? 'person is' : 'people are'} praying
                </Body>
              </View>
            </Card>
          ))
        )}

        <Button
          label="Share a prayer request"
          variant="secondary"
          onPress={() => Linking.openURL(`${API_URL}/app/prayer`)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.inkDeep },
  container: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
  section: { marginTop: theme.spacing(6) },
  courseBody: { marginVertical: theme.spacing(3), gap: theme.spacing(1) },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.inkBorder,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing(2),
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.gold },
  action: { marginTop: theme.spacing(4) },
  prayRow: { marginTop: theme.spacing(4), gap: theme.spacing(2) },
});
