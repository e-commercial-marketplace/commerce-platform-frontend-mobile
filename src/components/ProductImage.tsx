/**
 * Shared product image with a graceful fallback: if the source fails to
 * load, a neutral placeholder is shown instead of a broken image. It accepts
 * both source forms the Product type allows — local bundled assets
 * (`require()`) and remote `{ uri }` sources — so grid, list and detail all
 * render images through this single component. No extra image package is
 * required.
 */

import { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { colors } from '../constants/theme';

type ProductImageProps = {
  /** Image source: local asset id (require result) or remote `{ uri }` object. */
  source: ImageSourcePropType;
  /** Layout of the image frame (size, radius, ...). */
  style?: StyleProp<ImageStyle>;
};

export default function ProductImage({ source, style }: ProductImageProps) {
  // Stores the source that failed so the fallback resets automatically if
  // the prop ever changes (e.g. another product), without needing an effect.
  // Local asset ids compare by value; object sources by reference, which is
  // stable because they come from the data module.
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | null>(null);

  if (failedSource === source) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackIcon}>🖼️</Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={style}
      resizeMode="cover"
      onError={() => setFailedSource(source)}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  fallbackIcon: {
    fontSize: 28,
    opacity: 0.5,
  },
});
