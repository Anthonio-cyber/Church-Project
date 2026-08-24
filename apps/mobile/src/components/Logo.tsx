import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/lib/theme';

/**
 * The 𝒾Pastor lockup for the mobile app.
 *
 * The RCN seal is the app icon (assets/icon.png, generated from the same mark
 * as the web application), so here the header carries the wordmark: a script
 * "i" rendered as an italic serif glyph, then Pastor.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fontSize = size === 'lg' ? 30 : size === 'sm' ? 18 : 22;

  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="iPastor">
      <View style={[styles.seal, { width: fontSize * 1.4, height: fontSize * 1.4 }]}>
        <Text style={[styles.sealText, { fontSize: fontSize * 0.42 }]}>RCN</Text>
      </View>
      <Text style={[styles.wordmark, { fontSize }]}>
        <Text style={styles.wordmarkI}>i</Text>Pastor
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2.5) },
  seal: {
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.inkDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: { color: theme.colors.goldLight, fontWeight: '700', letterSpacing: 0.5 },
  wordmark: { color: theme.colors.parchment, fontWeight: '700', letterSpacing: -0.3 },
  wordmarkI: { color: theme.colors.goldLight, fontStyle: 'italic' },
});
