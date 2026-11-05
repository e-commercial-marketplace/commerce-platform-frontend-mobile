/**
 * Shop badge used on the product detail screen and on the shop page.
 *
 * The backend exposes no shop logo, so the badge is derived from the real
 * shop name: the first character becomes the badge letter. While the name is
 * not loaded yet a store glyph is shown instead of a made-up logo.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/theme';

type ShopAvatarProps = {
  /** Shop name; its first character becomes the badge letter. */
  name?: string;
  /** Diameter of the badge in points. */
  size?: number;
};

export default function ShopAvatar({ name, size = 56 }: ShopAvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() ?? '';

  return (
    <View
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="image"
      accessibilityLabel={name != null ? `${name} shop` : 'Shop'}
    >
      {initial.length > 0 ? (
        <Text style={[styles.letter, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
      ) : (
        <Text style={[styles.glyph, { fontSize: Math.round(size * 0.46) }]}>🏪</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '700',
    color: colors.primary,
  },
  glyph: {
    opacity: 0.6,
  },
});
