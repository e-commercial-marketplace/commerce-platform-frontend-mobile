/**
 * Shared placeholder layout used by scaffold screens until real UI exists.
 * Lives in components/ because it is presentation-only and reusable.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../constants/theme';

type PlaceholderScreenProps = {
  /** Screen name shown in the center of the screen. */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
};

export default function PlaceholderScreen({ title, subtitle = 'Placeholder screen' }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
