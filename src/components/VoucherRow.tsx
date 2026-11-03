/**
 * Một voucher: mã, phần trăm giảm, mô tả, hạn dùng và nút sao chép mã.
 * Có `onApply` thì chạm vào phần thông tin để áp dụng; vùng chạm này tách khỏi nút Copy.
 */

import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '../constants/theme';
import type { VoucherSummary } from '../types/voucherApi';

const COPIED_MS = 2000;

type VoucherRowProps = {
  voucher: VoucherSummary;
  /** Chạm vào phần thông tin để áp dụng; không truyền thì dòng chỉ để xem. */
  onApply?: () => void;
  /** Nhãn nổi bật phía trên mã. */
  badge?: string;
  /** Khoá thao tác áp dụng khi màn hình đang bận. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function VoucherRow({ voucher, onApply, badge, disabled = false, style }: VoucherRowProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn timer khi rời màn hình để không cập nhật state sau khi đã unmount.
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
      return; // Chép lỗi thì giữ nguyên nút; người dùng vẫn đọc được mã trên màn hình.
    }
    setCopied(true);
    if (timer.current != null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const info = (
    <>
      {badge != null ? <Text style={styles.badge}>{badge}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={styles.code} numberOfLines={1}>
          {voucher.code}
        </Text>
        <Text style={styles.percent}>-{voucher.discountPercent}%</Text>
      </View>
      {voucher.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {voucher.description}
        </Text>
      ) : null}
      <Text style={styles.expiry}>Expires {new Date(voucher.validTo).toLocaleDateString()}</Text>
    </>
  );

  return (
    <View style={[styles.container, style]}>
      {onApply != null ? (
        <Pressable
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
          onPress={onApply}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${badge != null ? `${badge}. ` : ''}Apply voucher ${voucher.code}`}
          accessibilityState={{ disabled }}
        >
          {info}
        </Pressable>
      ) : (
        <View style={styles.info}>{info}</View>
      )}
      <Pressable
        style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        onPress={() => {
          void handleCopy();
        }}
        accessibilityRole="button"
        accessibilityLabel={copied ? `Copied voucher ${voucher.code}` : `Copy voucher ${voucher.code}`}
      >
        <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
  },
  info: {
    flex: 1,
    minHeight: 44,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontSize: typography.xs,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  code: {
    flexShrink: 1,
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
  },
  percent: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.danger,
  },
  description: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  expiry: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  copyButton: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
  },
  copyText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.primary,
  },
});
