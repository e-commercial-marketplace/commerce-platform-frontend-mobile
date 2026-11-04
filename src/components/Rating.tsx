/**
 * Presentation-only rating row: star glyph + numeric value + review count.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
import { useAppTheme } from '../theme';

type RatingProps = {
  /** Average rating from 0 to 5. */
  rating: number;
  /** Optional number of reviews shown after the value. */
  reviewCount?: number;
  /** Base font size so cards and detail can scale it. */
  size?: number;
};

export default function Rating({ rating, reviewCount, size = 14 }: RatingProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.star, { fontSize: size }]}>★</Text>
      <Text style={[styles.value, { fontSize: size, color: theme.text }]}>
        {rating.toFixed(1)}
      </Text>
      {reviewCount !== undefined && (
        <Text style={[styles.count, { fontSize: Math.max(11, size - 2), color: theme.textSecondary }]}>
          ({reviewCount} reviews)
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  star: {
    color: colors.star,
    fontWeight: '700',
  },
  value: {
    fontWeight: '600',
  },
  count: {},
});
