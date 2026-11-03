/**
 * Seller Product Card component.
 *
 * Displays a single product owned by the seller:
 * - Image thumbnail (with neutral fallback placeholder)
 * - Product name & category
 * - Live price in VND
 * - Current stock level
 * - Visibility status badge (Listed / Unlisted)
 *
 * Actions:
 * - Edit: opens product edit screen
 * - Update Stock: opens absolute stock update modal
 * - Unlist / Relist: soft-delete or reactivate product listing
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { ProductSummaryDto } from '../../types/sellerProductApi';
import PriceDisplay from '../PriceDisplay';
import ProductImage from '../ProductImage';

const PLACEHOLDER_IMAGE = require('../../assets/products/iphone-15-pro.jpg');

export type SellerProductCardProps = {
  product: ProductSummaryDto;
  onEdit?: (product: ProductSummaryDto) => void;
  onUpdateStock?: (product: ProductSummaryDto) => void;
  onUnlist?: (product: ProductSummaryDto) => void;
  onRelist?: (product: ProductSummaryDto) => void;
  disabled?: boolean;
};

export default function SellerProductCard({
  product,
  onEdit,
  onUpdateStock,
  onUnlist,
  onRelist,
  disabled = false,
}: SellerProductCardProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

  const imageSource =
    product.imageUrl && product.imageUrl.trim().length > 0
      ? { uri: product.imageUrl }
      : PLACEHOLDER_IMAGE;

  const numPrice = Number(product.price) || 0;
  const isListed = product.active;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`seller-product-card-${product.id}`}
    >
      <View style={styles.mainRow}>
        <ProductImage
          source={imageSource}
          style={[styles.thumbnail, { backgroundColor: theme.surface }]}
        />

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.name, { color: theme.text }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {product.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isListed
                  ? isDark
                    ? { backgroundColor: 'rgba(34, 197, 94, 0.2)' }
                    : styles.statusBadgeActive
                  : isDark
                    ? { backgroundColor: 'rgba(148, 163, 184, 0.2)' }
                    : styles.statusBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isListed
                    ? { color: isDark ? '#4ADE80' : '#15803D' }
                    : { color: isDark ? '#94A3B8' : '#6B7280' },
                ]}
              >
                {isListed ? t('seller.filterListed', 'Listed') : t('seller.filterUnlisted', 'Unlisted')}
              </Text>
            </View>
          </View>

          {product.category?.name ? (
            <Text style={[styles.category, { color: theme.textSecondary }]}>
              {product.category.name}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <PriceDisplay price={numPrice} size="sm" />
            <Text style={[styles.stockText, { color: theme.textSecondary }]}>
              {t('seller.stockLabel', 'Stock:')}{' '}
              <Text style={[styles.stockValue, { color: theme.text }]}>{product.stock}</Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => onEdit?.(product)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${product.name}`}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionSecondary,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && styles.pressed,
            disabled && styles.disabledButton,
          ]}
        >
          <Text style={[styles.actionSecondaryText, { color: theme.text }]}>
            {t('seller.edit', 'Edit')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onUpdateStock?.(product)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Update stock for ${product.name}`}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionSecondary,
            { backgroundColor: theme.surface, borderColor: theme.border },
            pressed && styles.pressed,
            disabled && styles.disabledButton,
          ]}
        >
          <Text style={[styles.actionSecondaryText, { color: theme.text }]}>
            {t('seller.updateStock', 'Update Stock')}
          </Text>
        </Pressable>

        {isListed ? (
          <Pressable
            onPress={() => onUnlist?.(product)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Unlist ${product.name}`}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionDanger,
              isDark && {
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              },
              pressed && styles.pressed,
              disabled && styles.disabledButton,
            ]}
          >
            <Text style={[styles.actionDangerText, { color: theme.danger }]}>
              {t('seller.unlist', 'Unlist')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onRelist?.(product)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Relist ${product.name}`}
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionSuccess,
              isDark && {
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderColor: 'rgba(34, 197, 94, 0.4)',
              },
              pressed && styles.pressed,
              disabled && styles.disabledButton,
            ]}
          >
            <Text
              style={[
                styles.actionSuccessText,
                { color: isDark ? '#4ADE80' : '#15803D' },
              ]}
            >
              {t('seller.relist', 'Relist')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  name: {
    fontSize: typography.base,
    fontWeight: '700',
    flex: 1,
    color: colors.text,
  },
  category: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  stockText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  stockValue: {
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803D',
  },
  statusTextInactive: {
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  actionSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionSecondaryText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  actionDanger: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  actionDangerText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.danger,
  },
  actionSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  actionSuccessText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: '#15803D',
  },
  pressed: {
    opacity: 0.7,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
