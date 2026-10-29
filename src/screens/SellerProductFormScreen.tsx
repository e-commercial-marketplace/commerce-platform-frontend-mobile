/**
 * Seller Product Form Screen (Phase 4).
 *
 * Supports:
 * - Create Mode: route.params.mode === 'create'
 *   - Fields: Name, Description, Image URL, Price, Initial Stock, Category, Listed switch
 *   - Submits via POST /api/v1/seller/products (useCreateSellerProduct)
 * - Edit Mode: route.params.mode === 'edit' & route.params.productId
 *   - Loads existing product via useSellerProduct(productId)
 *   - Prefills: Name, Description, Image URL, Price, Category, Listed switch
 *   - CRITICAL: Does NOT include editable stock (stock is managed separately from list)
 *   - Submits via PATCH /api/v1/seller/products/{id} (useUpdateSellerProduct)
 * - Category Selector via useCategories()
 * - Validation matching backend invariants (image URL required when active=true, price > 0 max 2 dec, stock >= 0 integer)
 * - Comprehensive states: Loading detail, 403 authorization blocked, 404 not found, generic error retry
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useCategories } from '../hooks/useProducts';
import {
  useCreateSellerProduct,
  useSellerProduct,
  useUpdateSellerProduct,
} from '../hooks/useSellerProducts';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type {
  ProductCreateRequest,
  ProductUpdateRequest,
} from '../types/sellerProductApi';

type FormErrors = {
  name?: string;
  categoryId?: string;
  price?: string;
  stock?: string;
  imageUrl?: string;
};

export default function SellerProductFormScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'SellerProductForm'>) {
  const isEdit = route.params.mode === 'edit';
  const productId = isEdit ? route.params.productId : undefined;

  // Category query
  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
    refetch: refetchCategories,
  } = useCategories();

  // Product detail query (edit mode only)
  const {
    data: productDetail,
    isLoading: isLoadingDetail,
    isError: isErrorDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useSellerProduct(productId, isEdit);

  // Mutations
  const createMutation = useCreateSellerProduct();
  const updateMutation = useUpdateSellerProduct();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasInitialized, setHasInitialized] = useState(false);

  // Prefill form in edit mode once productDetail is loaded
  useEffect(() => {
    if (isEdit && productDetail && !hasInitialized) {
      setName(productDetail.name ?? '');
      setDescription(productDetail.description ?? '');
      setImageUrl(productDetail.imageUrl ?? '');
      setPrice(productDetail.price != null ? String(productDetail.price) : '');
      setCategoryId(productDetail.category?.id ?? '');
      setActive(productDetail.active ?? true);
      setHasInitialized(true);
    }
  }, [isEdit, productDetail, hasInitialized]);

  // Keyboard awareness & auto-scroll state
  const scrollViewRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Record<string, number>>({});
  const activeFieldRef = useRef<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleFieldFocus = (fieldKey: string) => {
    activeFieldRef.current = fieldKey;
    const yOffset = fieldOffsets.current[fieldKey];
    if (typeof yOffset === 'number' && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, yOffset - spacing.md),
        animated: true,
      });
    }
  };

  const handleFieldLayout = (fieldKey: string, y: number) => {
    fieldOffsets.current[fieldKey] = y;
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height ?? 0;
      setKeyboardHeight(height);

      // Re-scroll to the currently active field once keyboard is fully shown on Android
      const currentField = activeFieldRef.current;
      if (currentField) {
        const yOffset = fieldOffsets.current[currentField];
        if (typeof yOffset === 'number' && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: Math.max(0, yOffset - spacing.md),
            animated: true,
          });
        }
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      activeFieldRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Validation function
  const validate = (): { isValid: boolean; validationErrors: FormErrors } => {
    const validationErrors: FormErrors = {};

    // 1. Name validation
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      validationErrors.name = 'Product name is required';
    } else if (trimmedName.length > 255) {
      validationErrors.name = 'Product name must not exceed 255 characters';
    }

    // 2. Category validation
    if (!categoryId || categoryId.trim().length === 0) {
      validationErrors.categoryId = 'Category is required';
    }

    // 3. Price validation
    const trimmedPrice = price.trim();
    if (trimmedPrice.length === 0) {
      validationErrors.price = 'Price is required';
    } else {
      const priceRegex = /^\d+(\.\d{1,2})?$/;
      const numPrice = Number(trimmedPrice);
      if (isNaN(numPrice) || !priceRegex.test(trimmedPrice)) {
        if (!isNaN(numPrice) && numPrice <= 0) {
          validationErrors.price = 'Price must be greater than 0';
        } else {
          validationErrors.price =
            'Price must be a valid number with at most 2 decimal places';
        }
      } else if (numPrice <= 0) {
        validationErrors.price = 'Price must be greater than 0';
      }
    }

    // 4. Stock validation (Create mode only)
    if (!isEdit) {
      const trimmedStock = stock.trim();
      if (trimmedStock.length === 0) {
        validationErrors.stock = 'Initial stock is required';
      } else {
        const stockRegex = /^\d+$/;
        const numStock = Number(trimmedStock);
        if (!stockRegex.test(trimmedStock) || isNaN(numStock) || numStock < 0) {
          validationErrors.stock =
            'Stock must be a non-negative integer (0 or greater)';
        }
      }
    }

    // 5. Image URL validation
    const trimmedImageUrl = imageUrl.trim();
    if (active && trimmedImageUrl.length === 0) {
      validationErrors.imageUrl =
        'Image URL is required when listing product as active';
    } else if (trimmedImageUrl.length > 2048) {
      validationErrors.imageUrl = 'Image URL must not exceed 2048 characters';
    }

    return {
      isValid: Object.keys(validationErrors).length === 0,
      validationErrors,
    };
  };

  // Submit handler
  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const { isValid, validationErrors } = validate();
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    const trimmedImg = imageUrl.trim();
    const normalizedPrice = price.trim();

    try {
      if (isEdit) {
        if (!productId) {
          Alert.alert('Error', 'Product ID is missing.');
          return;
        }

        const updatePayload: ProductUpdateRequest = {
          name: trimmedName,
          description: trimmedDesc.length > 0 ? trimmedDesc : undefined,
          imageUrl: trimmedImg.length > 0 ? trimmedImg : undefined,
          price: normalizedPrice,
          categoryId,
          active,
        };

        await updateMutation.mutateAsync({
          id: productId,
          payload: updatePayload,
        });

        Alert.alert('Product Updated', `"${trimmedName}" has been updated successfully.`);
        navigation.goBack();
      } else {
        const createPayload: ProductCreateRequest = {
          name: trimmedName,
          description: trimmedDesc.length > 0 ? trimmedDesc : undefined,
          imageUrl: trimmedImg.length > 0 ? trimmedImg : undefined,
          price: normalizedPrice,
          stock: parseInt(stock.trim(), 10),
          categoryId,
          active,
        };

        await createMutation.mutateAsync(createPayload);

        Alert.alert('Product Created', `"${trimmedName}" has been created successfully.`);
        navigation.goBack();
      }
    } catch (err) {
      const apiError = toApiError(err);
      Alert.alert(isEdit ? 'Update Failed' : 'Create Failed', apiError.message);
    }
  };

  // ==========================================
  // EDIT MODE: LOADING & ERROR STATES
  // ==========================================
  if (isEdit && isLoadingDetail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="seller-product-form-loading">
        <View style={styles.header}>
          <Text style={styles.title}>Edit Product</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading product details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isEdit && isErrorDetail) {
    const apiError = toApiError(detailError);

    // 403 Forbidden / Not Approved
    if (apiError.status === 403) {
      return (
        <SafeAreaView style={styles.container} edges={['top']} testID="seller-product-form-403">
          <View style={styles.header}>
            <Text style={styles.title}>Edit Product</Text>
          </View>
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>Access Denied</Text>
            <Text style={styles.subtitle}>
              You are not authorized to edit this product, or your seller account is not approved.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.retryButton}
                onPress={() => void refetchDetail()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading product"
                testID="detail-retry-button"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
              {navigation.canGoBack?.() ? (
                <Pressable
                  style={[styles.retryButton, styles.secondaryButton]}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  testID="detail-back-button"
                >
                  <Text style={styles.secondaryButtonText}>Go Back</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      );
    }

    // 404 Not Found
    if (apiError.status === 404) {
      return (
        <SafeAreaView style={styles.container} edges={['top']} testID="seller-product-form-404">
          <View style={styles.header}>
            <Text style={styles.title}>Edit Product</Text>
          </View>
          <View style={styles.centerState}>
            <Text style={styles.errorTitle}>Product Not Found</Text>
            <Text style={styles.subtitle}>
              The product you are trying to edit could not be found.
            </Text>
            {navigation.canGoBack?.() ? (
              <Pressable
                style={styles.retryButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="detail-back-button"
              >
                <Text style={styles.retryButtonText}>Go Back</Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      );
    }

    // Generic error
    return (
      <SafeAreaView style={styles.container} edges={['top']} testID="seller-product-form-error">
        <View style={styles.header}>
          <Text style={styles.title}>Edit Product</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Couldn't load product</Text>
          <Text style={styles.subtitle}>{apiError.message}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={styles.retryButton}
              onPress={() => void refetchDetail()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading product"
              testID="detail-retry-button"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            {navigation.canGoBack?.() ? (
              <Pressable
                style={[styles.retryButton, styles.secondaryButton]}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="detail-back-button"
              >
                <Text style={styles.secondaryButtonText}>Go Back</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView
        style={styles.container}
        edges={['top']}
        testID="seller-product-form-screen"
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEdit ? 'Edit Product' : 'New Product'}
          </Text>
          {navigation.canGoBack?.() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.cancelHeaderButton}
              testID="header-cancel-button"
            >
              <Text style={styles.cancelHeaderText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: Math.max(spacing.xxl, keyboardHeight + spacing.xl),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
        >
          {/* Product Name */}
          <View
            style={styles.field}
            onLayout={(e) => handleFieldLayout('name', e.nativeEvent.layout.y)}
          >
            <Text style={styles.label}>Product Name *</Text>
            <View
              style={[
                styles.inputShell,
                errors.name != null && styles.inputShellError,
              ]}
            >
              <TextInput
                style={styles.input}
                value={name}
                onFocus={() => handleFieldFocus('name')}
                onChangeText={(val) => {
                  setName(val);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="e.g. Mechanical Gaming Keyboard"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Product Name"
                testID="name-input"
              />
            </View>
            {errors.name ? (
              <Text style={styles.errorText} testID="name-error-text">
                {errors.name}
              </Text>
            ) : null}
          </View>

          {/* Category Selector */}
          <View
            style={styles.field}
            onLayout={(e) => handleFieldLayout('category', e.nativeEvent.layout.y)}
          >
            <Text style={styles.label}>Category *</Text>
            {isLoadingCategories ? (
              <View style={styles.categoryLoading} testID="categories-loading">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.categorySubtext}>Loading categories…</Text>
              </View>
            ) : isErrorCategories ? (
              <View style={styles.categoryError} testID="categories-error">
                <Text style={styles.errorText}>Failed to load categories</Text>
                <Pressable
                  onPress={() => void refetchCategories()}
                  style={styles.categoryRetryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading categories"
                  testID="categories-retry-button"
                >
                  <Text style={styles.categoryRetryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={styles.categoryChipsContainer}
                testID="categories-container"
              >
                {categories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        setCategoryId(cat.id);
                        if (errors.categoryId) {
                          setErrors((prev) => ({
                            ...prev,
                            categoryId: undefined,
                          }));
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select category ${cat.name}`}
                      accessibilityState={{ selected: isSelected }}
                      testID={`category-option-${cat.id}`}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {errors.categoryId ? (
              <Text style={styles.errorText} testID="category-error-text">
                {errors.categoryId}
              </Text>
            ) : null}
          </View>

          {/* Price */}
          <View
            style={styles.field}
            onLayout={(e) => handleFieldLayout('price', e.nativeEvent.layout.y)}
          >
            <Text style={styles.label}>Price (VND) *</Text>
            <View
              style={[
                styles.inputShell,
                errors.price != null && styles.inputShellError,
              ]}
            >
              <TextInput
                style={styles.input}
                value={price}
                onFocus={() => handleFieldFocus('price')}
                onChangeText={(val) => {
                  setPrice(val);
                  if (errors.price) {
                    setErrors((prev) => ({ ...prev, price: undefined }));
                  }
                }}
                placeholder="e.g. 250000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                accessibilityLabel="Price"
                testID="price-input"
              />
            </View>
            {errors.price ? (
              <Text style={styles.errorText} testID="price-error-text">
                {errors.price}
              </Text>
            ) : null}
          </View>

          {/* Stock — Create Mode Only */}
          {!isEdit ? (
            <View
              style={styles.field}
              onLayout={(e) => handleFieldLayout('stock', e.nativeEvent.layout.y)}
            >
              <Text style={styles.label}>Initial Stock *</Text>
              <View
                style={[
                  styles.inputShell,
                  errors.stock != null && styles.inputShellError,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={stock}
                  onFocus={() => handleFieldFocus('stock')}
                  onChangeText={(val) => {
                    setStock(val);
                    if (errors.stock) {
                      setErrors((prev) => ({ ...prev, stock: undefined }));
                    }
                  }}
                  placeholder="e.g. 10"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  accessibilityLabel="Initial Stock"
                  testID="stock-input"
                />
              </View>
              {errors.stock ? (
                <Text style={styles.errorText} testID="stock-error-text">
                  {errors.stock}
                </Text>
              ) : null}
            </View>
          ) : (
            <View
              style={styles.stockNoticeBox}
              onLayout={(e) => handleFieldLayout('stock', e.nativeEvent.layout.y)}
              testID="stock-notice-box"
            >
              <Text style={styles.stockNoticeTitle}>
                Current Stock: {productDetail?.stock ?? 0}
              </Text>
              <Text style={styles.stockNoticeText}>
                Stock is managed separately from My Products.
              </Text>
            </View>
          )}

          {/* Image URL */}
          <View
            style={styles.field}
            onLayout={(e) => handleFieldLayout('imageUrl', e.nativeEvent.layout.y)}
          >
            <Text style={styles.label}>
              Image URL {active ? '*' : '(Optional)'}
            </Text>
            <View
              style={[
                styles.inputShell,
                errors.imageUrl != null && styles.inputShellError,
              ]}
            >
              <TextInput
                style={styles.input}
                value={imageUrl}
                onFocus={() => handleFieldFocus('imageUrl')}
                onChangeText={(val) => {
                  setImageUrl(val);
                  if (errors.imageUrl) {
                    setErrors((prev) => ({ ...prev, imageUrl: undefined }));
                  }
                }}
                placeholder="https://example.com/product.jpg"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Image URL"
                testID="image-url-input"
              />
            </View>
            {errors.imageUrl ? (
              <Text style={styles.errorText} testID="image-url-error-text">
                {errors.imageUrl}
              </Text>
            ) : null}
          </View>

          {/* Description */}
          <View
            style={styles.field}
            onLayout={(e) => handleFieldLayout('description', e.nativeEvent.layout.y)}
          >
            <Text style={styles.label}>Description (Optional)</Text>
            <View style={[styles.inputShell, styles.multilineShell]}>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={description}
                onFocus={() => handleFieldFocus('description')}
                onChangeText={setDescription}
                placeholder="Enter detailed description of your product..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel="Description"
                testID="description-input"
              />
            </View>
          </View>

          {/* Active / Listed Switch */}
          <View
            style={styles.switchRow}
            onLayout={(e) => handleFieldLayout('active', e.nativeEvent.layout.y)}
          >
            <View style={styles.switchInfo}>
              <Text style={styles.label}>Product Visibility</Text>
              <Text style={styles.switchSubtext}>
                {active
                  ? 'Listed: visible on marketplace'
                  : 'Unlisted: hidden from buyers'}
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={(val) => {
                setActive(val);
                if (errors.imageUrl) {
                  setErrors((prev) => ({ ...prev, imageUrl: undefined }));
                }
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.onPrimary}
              accessibilityLabel="Toggle product visibility"
              testID="active-switch"
            />
          </View>

          {/* Submit Button */}
          <View
            style={styles.submitContainer}
            onLayout={(e) => handleFieldLayout('submit', e.nativeEvent.layout.y)}
          >
            <Pressable
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={isEdit ? 'Save Changes' : 'Create Product'}
              testID="submit-button"
            >
              {isSubmitting ? (
                <View style={styles.submitButtonRow}>
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                  <Text style={styles.submitButtonText}>
                    {isEdit ? 'Saving…' : 'Creating…'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {isEdit ? 'Save Changes' : 'Create Product'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  cancelHeaderButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelHeaderText: {
    fontSize: typography.md,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  multilineShell: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: 84,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.danger,
    marginTop: 2,
  },
  categoryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  categorySubtext: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  categoryError: {
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  categoryRetryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRetryText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: typography.md,
    color: colors.text,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  stockNoticeBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  stockNoticeTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  stockNoticeText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.xs,
  },
  switchInfo: {
    flex: 1,
    gap: 2,
    marginRight: spacing.md,
  },
  switchSubtext: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  submitContainer: {
    marginTop: spacing.sm,
  },
  submitButton: {
    minHeight: 50,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  submitButtonText: {
    color: colors.onPrimary,
    fontSize: typography.base,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: 280,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
    maxWidth: 280,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.base,
    fontWeight: '600',
  },
});
