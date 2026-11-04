/**
 * Shared placeholder layout used by scaffold screens.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '../constants/theme';
import { useAppTheme } from '../theme';

type PlaceholderScreenProps = {
  /** Screen name shown in the center of the screen. */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
};

export default function PlaceholderScreen({
  title,
  subtitle = 'Placeholder screen',
}: PlaceholderScreenProps) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
  },
});
