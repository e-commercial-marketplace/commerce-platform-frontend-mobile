/**
 * Modal dialog for writing and submitting a customer product review.
 *
 * Implements client-side validation (1..5 star rating, non-blank comment up to 2000 chars),
 * loading state to prevent duplicate submissions, and maps structured backend errors
 * (e.g. REVIEW_NOT_ELIGIBLE, REVIEW_ALREADY_EXISTS) into user-friendly messages.
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
import { colors, radii, spacing, typography } from '../constants/theme';
import { useCreateReview } from '../hooks/useReviews';
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
        setErrorMessage('Please select a star rating from 1 to 5.');
        return;
      }
      if (trimmedComment.length === 0) {
        setErrorMessage('Please write a review comment.');
        return;
      }
      if (comment.length > 2000) {
        setErrorMessage('Review comment must not exceed 2000 characters.');
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
      Alert.alert('Review Submitted', 'Thank you for your feedback!');
      onSuccess?.(result);
    } catch (err) {
      const apiError = toApiError(err);

      if (apiError.code === 'REVIEW_NOT_ELIGIBLE') {
        setErrorMessage('You can review this product after completing an order for it.');
      } else if (apiError.code === 'REVIEW_ALREADY_EXISTS') {
        setErrorMessage('You have already reviewed this product.');
      } else if (apiError.status === 401) {
        setErrorMessage('Please log in to submit a review.');
      } else if (apiError.status === 403) {
        setErrorMessage('Customer accounts only can submit reviews.');
      } else if (apiError.code === 'VALIDATION_ERROR' && apiError.fieldErrors) {
        const firstField = Object.values(apiError.fieldErrors)[0];
        setErrorMessage(firstField || apiError.message);
      } else {
        setErrorMessage(apiError.message || 'Failed to submit review. Please try again.');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.outsidePress} onPress={handleClose} />
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <Text style={styles.productName} numberOfLines={1}>
                {productName}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={isPending}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close review dialog"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* Rating Stars Selector */}
            <Text style={styles.fieldLabel}>Rating</Text>
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
                    accessibilityLabel={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
                    accessibilityState={{ selected: starValue === rating }}
                  >
                    <Text
                      style={[
                        styles.starGlyph,
                        isFilled ? styles.starFilled : styles.starEmpty,
                      ]}
                    >
                      ★
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={styles.ratingNumber}>
                {rating > 0 ? `${rating} / 5` : 'Select rating'}
              </Text>
            </View>

            {/* Comment Field */}
            <View style={styles.commentLabelRow}>
              <Text style={styles.fieldLabel}>Your Comment</Text>
              <Text
                style={[
                  styles.charCounter,
                  comment.length > 2000 && styles.charCounterLimit,
                ]}
              >
                {comment.length}/2000
              </Text>
            </View>

            <TextInput
              style={[
                styles.textArea,
                errorMessage != null && styles.textAreaError,
              ]}
              multiline
              numberOfLines={4}
              placeholder="What did you think of the product?"
              placeholderTextColor={colors.textSecondary}
              value={comment}
              onChangeText={handleCommentChange}
              maxLength={2000}
              editable={!isPending}
              textAlignVertical="top"
              accessibilityLabel="Review comment input"
            />

            {/* Error Container */}
            {errorMessage != null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              disabled={isPending}
              style={styles.cancelButton}
            />
            <Button
              title="Submit Review"
              variant="primary"
              onPress={handleSubmit}
              loading={isPending}
              disabled={!isValid || isPending}
              style={styles.submitButton}
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
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
    backgroundColor: colors.background,
    borderRadius: radii.lg,
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
    borderBottomColor: colors.border,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  productName: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  body: {
    marginVertical: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
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
  starFilled: {
    color: colors.star,
  },
  starEmpty: {
    color: colors.border,
  },
  ratingNumber: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
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
    color: colors.textSecondary,
  },
  charCounterLimit: {
    color: colors.danger,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 100,
    fontSize: typography.base,
    color: colors.text,
  },
  textAreaError: {
    borderColor: colors.danger,
  },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FEECEC',
    borderRadius: radii.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
