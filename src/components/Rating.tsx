/**
 * Presentation-only rating row: star glyph + numeric value + review count.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';

type RatingProps = {
  /** Average rating from 0 to 5. */
  rating: number;
  /** Optional number of reviews shown after the value. */
  reviewCount?: number;
  /** Base font size so cards and detail can scale it. */
  size?: number;
};

export default function Rating({ rating, reviewCount, size = 14 }: RatingProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.star, { fontSize: size }]}>★</Text>
      <Text style={[styles.value, { fontSize: size }]}>{rating.toFixed(1)}</Text>
      {reviewCount !== undefined && (
        <Text style={[styles.count, { fontSize: Math.max(11, size - 2) }]}>({reviewCount} reviews)</Text>
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
    color: colors.text,
    fontWeight: '600',
  },
  count: {
    color: colors.textSecondary,
  },
});
