/**
 * Reviews & ratings section displayed on the Product Detail screen.
 *
 * Displays:
 * - Aggregate rating and review count
 * - List of customer reviews with 1..5 stars, date, and comment
 * - Privacy-safe anonymous reviewer label ("Verified Customer") - never raw UUIDs
 * - Empty state when no reviews exist
 * - Loading and error states with retry
 * - Safe "Load more" pagination when totalPages > 1
 * - "Write a Review" action button
 * - Semantic theme tokens for Light and Dark modes
 * - Localized across English and Vietnamese via i18next reviews namespace
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Button from './Button';
import { radii, spacing, typography } from '../constants/theme';
import { useProductReviews } from '../hooks/useReviews';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';
import type { ReviewResponse } from '../types/reviewApi';

type ProductReviewsProps = {
  productId: string;
  productName: string;
  averageRating: number;
  reviewCount: number;
  onOpenWriteReview?: () => void;
  canWriteReview?: boolean;
};

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export default function ProductReviews({
  productId,
  productName: _productName,
  averageRating,
  reviewCount,
  onOpenWriteReview,
  canWriteReview = true,
}: ProductReviewsProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const [page, setPage] = useState(0);
  const [reviewsList, setReviewsList] = useState<ReviewResponse[]>([]);

  const { data, isPending, isError, error, refetch } = useProductReviews(productId, page, 5);

  // Reset page and review list when target product changes
  useEffect(() => {
    setPage(0);
    setReviewsList([]);
  }, [productId]);

  // Synchronize and accumulate reviews on page change / fetch
  useEffect(() => {
    if (data?.content) {
      setReviewsList((prev) => {
        if (page === 0) {
          if (
            prev.length === data.content.length &&
            prev.every((item, i) => item.id === data.content[i]?.id)
          ) {
            return prev;
          }
          return data.content;
        }
        const existingIds = new Set(prev.map((r) => r.id));
        const newItems = data.content.filter((r) => !existingIds.has(r.id));
        if (newItems.length === 0) {
          return prev;
        }
        return [...prev, ...newItems];
      });
    }
  }, [data?.content, page]);

  const hasMore = data != null && page < data.totalPages - 1;

  const handleLoadMore = () => {
    if (hasMore && !isPending) {
      setPage((prev) => prev + 1);
    }
  };

  const starColor = '#F59E0B';

  return (
    <View style={styles.container}>
      {/* Header with Title and Write Review action */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('reviews.customerReviews', 'Customer Reviews')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            {reviewCount > 0
              ? t(
                  reviewCount === 1 ? 'reviews.verifiedRatings_one' : 'reviews.verifiedRatings_other',
                  `${reviewCount} verified ratings`,
                  { count: reviewCount },
                )
              : t('reviews.noRatingsYet', 'No ratings yet')}
          </Text>
        </View>
        {canWriteReview && onOpenWriteReview != null && (
          <Pressable
            onPress={onOpenWriteReview}
            style={({ pressed }) => [
              styles.writeReviewButton,
              {
                borderColor: theme.primary,
                backgroundColor: theme.surface,
              },
              pressed && styles.writeReviewButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('reviews.writeReviewA11y', 'Write a review')}
          >
            <Text style={[styles.writeReviewButtonText, { color: theme.primary }]}>
              {t('reviews.writeReview', 'Write a Review')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Aggregate Rating Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.scoreGroup}>
          <Text style={[styles.scoreText, { color: theme.text }]}>
            {averageRating.toFixed(1)}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text
                key={star}
                style={[
                  styles.starGlyph,
                  star <= Math.round(averageRating)
                    ? { color: starColor }
                    : { color: theme.border },
                ]}
              >
                ★
              </Text>
            ))}
          </View>
          <Text style={[styles.reviewCountText, { color: theme.textSecondary }]}>
            {t(
              reviewCount === 1 ? 'reviews.basedOnReviews_one' : 'reviews.basedOnReviews_other',
              `Based on ${reviewCount} review${reviewCount === 1 ? '' : 's'}`,
              { count: reviewCount },
            )}
          </Text>
        </View>
      </View>

      {/* Loading state for initial fetch */}
      {isPending && reviewsList.length === 0 && (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('reviews.loadingReviews', 'Loading reviews…')}
          </Text>
        </View>
      )}

      {/* Error state */}
      {isError && reviewsList.length === 0 && (
        <View
          style={[
            styles.errorState,
            {
              backgroundColor: theme.surface,
            },
          ]}
        >
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            {t('reviews.couldNotLoadReviews', 'Could not load reviews')}
          </Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            {error instanceof Error ? error.message : t('common.error', 'Please try again.')}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel={t('reviews.retryLoadingReviews', 'Retry loading reviews')}
          >
            <Text style={styles.retryButtonText}>{t('reviews.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      )}

      {/* Empty State */}
      {!isPending && !isError && reviewsList.length === 0 && (
        <View
          style={[
            styles.emptyState,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('reviews.noReviewsYetTitle', 'No reviews yet')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {t(
              'reviews.noReviewsYetSubtitle',
              'Be the first customer to share your thoughts on this product!',
            )}
          </Text>
        </View>
      )}

      {/* Reviews List */}
      {reviewsList.length > 0 && (
        <View style={styles.list}>
          {reviewsList.map((review) => (
            <View
              key={review.id}
              style={[
                styles.reviewCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                    <Text style={styles.avatarText}>✓</Text>
                  </View>
                  <View>
                    <Text style={[styles.reviewerName, { color: theme.text }]}>
                      {t('reviews.verifiedCustomer', 'Verified Customer')}
                    </Text>
                    <Text style={[styles.reviewDate, { color: theme.textSecondary }]}>
                      {formatDate(review.createdAt)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.ratingBadge,
                    {
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFF7E6',
                    },
                  ]}
                >
                  <Text style={[styles.ratingBadgeStar, { color: starColor }]}>★</Text>
                  <Text style={[styles.ratingBadgeText, { color: theme.text }]}>
                    {review.rating}
                  </Text>
                </View>
              </View>

              <Text style={[styles.commentText, { color: theme.text }]}>{review.comment}</Text>
            </View>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <Button
              title={
                isPending
                  ? t('reviews.loadingMore', 'Loading more…')
                  : t('reviews.loadMoreReviews', 'Load more reviews')
              }
              variant="secondary"
              onPress={handleLoadMore}
              loading={isPending}
              disabled={isPending}
              style={styles.loadMoreButton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  writeReviewButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  writeReviewButtonPressed: {
    opacity: 0.7,
  },
  writeReviewButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  scoreGroup: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  starGlyph: {
    fontSize: 16,
  },
  reviewCountText: {
    fontSize: typography.xs,
  },
  centerState: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sm,
  },
  errorState: {
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorIcon: {
    fontSize: 24,
  },
  errorTitle: {
    fontSize: typography.md,
    fontWeight: '600',
  },
  errorText: {
    fontSize: typography.xs,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.xs,
    fontWeight: '600',
  },
  emptyState: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: typography.md,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: typography.xs,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  reviewCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewerName: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: typography.xs,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.pill,
    gap: 2,
  },
  ratingBadgeStar: {
    fontSize: 12,
  },
  ratingBadgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  commentText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  loadMoreButton: {
    marginTop: spacing.xs,
  },
});
