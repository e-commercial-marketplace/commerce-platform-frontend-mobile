/**
 * A voucher: code, discount percentage, description, expiry and a copy-code button.
 * If given `onApply` then tap the info area to apply; this tap zone is separate from the Copy button.
 * Theme & Language aware.
 */

import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radii, spacing, typography } from '../constants/theme';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';
import type { VoucherSummary } from '../types/voucherApi';

const COPIED_MS = 2000;

type VoucherRowProps = {
  voucher: VoucherSummary;
  /** Tap the info area to apply; when not passed, the row is view-only. */
  onApply?: () => void;
  /** Highlight label above the code. */
  badge?: string;
  /** Lock the apply action while the screen is busy. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function VoucherRow({ voucher, onApply, badge, disabled = false, style }: VoucherRowProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the timer when leaving the screen so state is not updated after unmount.
  useEffect(
    () => () => {
      if (timer.current != null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(voucher.code);
    } catch {
      return; // If copying fails the button stays as is; the user can still read the code on screen.
    }
    setCopied(true);
    if (timer.current != null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const formattedDate = new Date(voucher.validTo).toLocaleDateString();
  const expiresText = t('catalog.expiresOn', `Expires ${formattedDate}`, { date: formattedDate });
  const copyLabel = copied
    ? t('catalog.copiedVoucherCode', `Copied voucher ${voucher.code}`, { code: voucher.code })
    : t('catalog.copyVoucherCode', `Copy voucher ${voucher.code}`, { code: voucher.code });
  const applyLabel = `${badge != null ? `${badge}. ` : ''}${t('catalog.applyVoucher', `Apply voucher ${voucher.code}`, { code: voucher.code })}`;

  const info = (
    <>
      {badge != null ? (
        <Text style={[styles.badge, { backgroundColor: theme.primary, color: theme.onPrimary }]}>
          {badge}
        </Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text style={[styles.code, { color: theme.text }]} numberOfLines={1}>
          {voucher.code}
        </Text>
        <Text style={[styles.percent, { color: theme.primary }]}>-{voucher.discountPercent}%</Text>
      </View>
      {voucher.description ? (
        <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
          {voucher.description}
        </Text>
      ) : null}
      <Text style={[styles.expiry, { color: theme.textSecondary }]}>{expiresText}</Text>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {onApply != null ? (
        <Pressable
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
          onPress={onApply}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={applyLabel}
          accessibilityState={{ disabled }}
        >
          {info}
        </Pressable>
      ) : (
        <View style={styles.info}>{info}</View>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.copyButton,
          { borderColor: theme.primary },
          pressed && styles.pressed,
        ]}
        onPress={() => {
          void handleCopy();
        }}
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
      >
        <Text style={[styles.copyText, { color: theme.primary }]}>
          {copied ? t('catalog.copied', 'Copied') : t('catalog.copy', 'Copy')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  code: {
    fontSize: typography.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  percent: {
    fontSize: typography.md,
    fontWeight: '700',
  },
  description: {
    fontSize: typography.sm,
  },
  expiry: {
    fontSize: 12,
  },
  copyButton: {
    minHeight: 40,
    minWidth: 64,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  copyText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
