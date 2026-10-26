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
import { colors, radii, spacing, typography } from '../constants/theme';
import { useProductReviews } from '../hooks/useReviews';
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

  return (
    <View style={styles.container}>
      {/* Header with Title and Write Review action */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>
          <Text style={styles.sectionSubtitle}>
            {reviewCount > 0 ? `${reviewCount} verified ratings` : 'No ratings yet'}
          </Text>
        </View>
        {canWriteReview && onOpenWriteReview != null && (
          <Pressable
            onPress={onOpenWriteReview}
            style={({ pressed }) => [
              styles.writeReviewButton,
              pressed && styles.writeReviewButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Write a review"
          >
            <Text style={styles.writeReviewButtonText}>Write a Review</Text>
          </Pressable>
        )}
      </View>

      {/* Aggregate Rating Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.scoreGroup}>
          <Text style={styles.scoreText}>{averageRating.toFixed(1)}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text
                key={star}
                style={[
                  styles.starGlyph,
                  star <= Math.round(averageRating) ? styles.starFilled : styles.starEmpty,
                ]}
              >
                ★
              </Text>
            ))}
          </View>
          <Text style={styles.reviewCountText}>
            Based on {reviewCount} review{reviewCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      {/* Loading state for initial fetch */}
      {isPending && reviewsList.length === 0 && (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading reviews…</Text>
        </View>
      )}

      {/* Error state */}
      {isError && reviewsList.length === 0 && (
        <View style={styles.errorState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load reviews</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Please check your connection and try again.'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading reviews"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Empty State */}
      {!isPending && !isError && reviewsList.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptySubtitle}>
            Be the first customer to share your thoughts on this product!
          </Text>
        </View>
      )}

      {/* Reviews List */}
      {reviewsList.length > 0 && (
        <View style={styles.list}>
          {reviewsList.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>✓</Text>
                  </View>
                  <View>
                    <Text style={styles.reviewerName}>Verified Customer</Text>
                    <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                  </View>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeStar}>★</Text>
                  <Text style={styles.ratingBadgeText}>{review.rating}</Text>
                </View>
              </View>

              <Text style={styles.commentText}>{review.comment}</Text>
            </View>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <Button
              title={isPending ? 'Loading more…' : 'Load more reviews'}
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
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  writeReviewButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  writeReviewButtonPressed: {
    opacity: 0.7,
  },
  writeReviewButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  scoreGroup: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
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
  starFilled: {
    color: colors.star,
  },
  starEmpty: {
    color: colors.border,
  },
  reviewCountText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  centerState: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  errorState: {
    padding: spacing.md,
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  errorText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontSize: typography.xs,
    fontWeight: '600',
  },
  emptyState: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  reviewerName: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  reviewDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7E6',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.pill,
    gap: 2,
  },
  ratingBadgeStar: {
    color: colors.star,
    fontSize: 12,
  },
  ratingBadgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.text,
  },
  commentText: {
    fontSize: typography.sm,
    color: colors.text,
    lineHeight: 20,
  },
  loadMoreButton: {
    marginTop: spacing.xs,
  },
});
