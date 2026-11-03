/**
 * Modal dialog for writing and submitting a customer product review.
 *
 * Implements client-side validation (1..5 star rating, non-blank comment up to 2000 chars),
 * loading state to prevent duplicate submissions, and maps structured backend errors
 * (e.g. REVIEW_NOT_ELIGIBLE, REVIEW_ALREADY_EXISTS) into user-friendly messages.
 *
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 * Localized across English and Vietnamese via i18next reviews namespace.
 */

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { toApiError } from '../api/errors';
import Button from './Button';
import { radii, spacing, typography } from '../constants/theme';
import { useCreateReview } from '../hooks/useReviews';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';
import type { ReviewResponse } from '../types/reviewApi';

type WriteReviewModalProps = {
  visible: boolean;
  productId: string;
  productName: string;
  onClose: () => void;
  onSuccess?: (review: ReviewResponse) => void;
};

export default function WriteReviewModal({
  visible,
  productId,
  productName,
  onClose,
  onSuccess,
}: WriteReviewModalProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createReviewMutation = useCreateReview();
  const isPending = createReviewMutation.isPending;

  const handleClose = () => {
    if (isPending) {
      return;
    }
    setErrorMessage(null);
    onClose();
  };

  const handleRatingSelect = (selected: number) => {
    setRating(selected);
    setErrorMessage(null);
  };

  const handleCommentChange = (text: string) => {
    setComment(text);
    if (errorMessage != null) {
      setErrorMessage(null);
    }
  };

  const trimmedComment = comment.trim();
  const isValid = rating >= 1 && rating <= 5 && trimmedComment.length > 0 && comment.length <= 2000;

  const handleSubmit = async () => {
    if (!isValid || isPending) {
      if (rating < 1 || rating > 5) {
        setErrorMessage(
          t('reviews.ratingRequired', 'Please select a star rating from 1 to 5.'),
        );
        return;
      }
      if (trimmedComment.length === 0) {
        setErrorMessage(t('reviews.commentRequired', 'Please write a review comment.'));
        return;
      }
      if (comment.length > 2000) {
        setErrorMessage(
          t(
            'reviews.commentMaxLength',
            'Review comment must not exceed 2000 characters.',
          ),
        );
        return;
      }
      return;
    }

    setErrorMessage(null);

    try {
      const result = await createReviewMutation.mutateAsync({
        productId,
        data: {
          rating,
          comment: trimmedComment,
        },
      });

      // Clear local state
      setComment('');
      setRating(5);
      setErrorMessage(null);

      onClose();
      Alert.alert(
        t('reviews.reviewSubmittedTitle', 'Review Submitted'),
        t('reviews.reviewSubmittedMessage', 'Thank you for your feedback!'),
      );
      onSuccess?.(result);
    } catch (err) {
      const apiError = toApiError(err);

      if (apiError.code === 'REVIEW_NOT_ELIGIBLE') {
        setErrorMessage(
          t(
            'reviews.reviewNotEligible',
            'You can review this product after completing an order for it.',
          ),
        );
      } else if (apiError.code === 'REVIEW_ALREADY_EXISTS') {
        setErrorMessage(
          t('reviews.reviewAlreadyExists', 'You have already reviewed this product.'),
        );
      } else if (apiError.status === 401) {
        setErrorMessage(t('reviews.loginRequired', 'Please log in to submit a review.'));
      } else if (apiError.status === 403) {
        setErrorMessage(
          t('reviews.customerOnly', 'Customer accounts only can submit reviews.'),
        );
      } else if (apiError.code === 'VALIDATION_ERROR' && apiError.fieldErrors) {
        const firstField = Object.values(apiError.fieldErrors)[0];
        setErrorMessage(firstField || apiError.message);
      } else {
        setErrorMessage(
          apiError.message ||
            t('reviews.failedToSubmit', 'Failed to submit review. Please try again.'),
        );
      }
    }
  };

  const starColor = '#F59E0B';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)' },
        ]}
      >
        <Pressable style={styles.outsidePress} onPress={handleClose} />
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('reviews.writeReview', 'Write a Review')}
              </Text>
              <Text
                style={[styles.productName, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {productName}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={isPending}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel={t('reviews.closeDialog', 'Close review dialog')}
            >
              <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Rating Stars Selector */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              {t('reviews.rating', 'Rating')}
            </Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((starValue) => {
                const isFilled = starValue <= rating;
                return (
                  <Pressable
                    key={starValue}
                    onPress={() => handleRatingSelect(starValue)}
                    disabled={isPending}
                    style={styles.starTouch}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      starValue === 1 ? 'reviews.rateStars_one' : 'reviews.rateStars_other',
                      `Rate ${starValue} star${starValue > 1 ? 's' : ''}`,
                      { count: starValue },
                    )}
                    accessibilityState={{ selected: starValue === rating }}
                  >
                    <Text
                      style={[
                        styles.starGlyph,
                        isFilled ? { color: starColor } : { color: theme.border },
                      ]}
                    >
                      ★
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={[styles.ratingNumber, { color: theme.text }]}>
                {rating > 0
                  ? t('reviews.ratingScore', `${rating} / 5`, { score: rating })
                  : t('reviews.selectRating', 'Select rating')}
              </Text>
            </View>

            {/* Comment Field */}
            <View style={styles.commentLabelRow}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>
                {t('reviews.yourComment', 'Your Comment')}
              </Text>
              <Text
                style={[
                  styles.charCounter,
                  { color: theme.textSecondary },
                  comment.length > 2000 && { color: theme.danger, fontWeight: '600' },
                ]}
              >
                {comment.length}/2000
              </Text>
            </View>

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
                errorMessage != null && { borderColor: theme.danger },
              ]}
              multiline
              numberOfLines={4}
              placeholder={t(
                'reviews.commentPlaceholder',
                'What did you think of the product?',
              )}
              placeholderTextColor={theme.textSecondary}
              value={comment}
              onChangeText={handleCommentChange}
              maxLength={2000}
              editable={!isPending}
              textAlignVertical="top"
              accessibilityLabel="Review comment input"
            />

            {/* Error Container */}
            {errorMessage != null && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEECEC',
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.danger }]}>
                  {errorMessage}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Button
              title={t('reviews.cancel', 'Cancel')}
              variant="secondary"
              onPress={handleClose}
              disabled={isPending}
              style={styles.cancelButton}
              accessibilityLabel={t('reviews.cancel', 'Cancel')}
            />
            <Button
              title={t('reviews.submitReview', 'Submit Review')}
              variant="primary"
              onPress={handleSubmit}
              loading={isPending}
              disabled={!isValid || isPending}
              style={styles.submitButton}
              accessibilityLabel={t('reviews.submitReview', 'Submit Review')}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  outsidePress: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  productName: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    marginVertical: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  starTouch: {
    padding: spacing.xs,
  },
  starGlyph: {
    fontSize: 28,
  },
  ratingNumber: {
    fontSize: typography.md,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  commentLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  charCounter: {
    fontSize: typography.xs,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 100,
    fontSize: typography.base,
  },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  errorText: {
    fontSize: typography.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
