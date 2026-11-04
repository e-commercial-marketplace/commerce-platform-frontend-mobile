/**
 * Reusable Accessible Modal Wrapper.
 *
 * Implements:
 * 1. Semi-transparent backdrop overlay with dismiss tap
 * 2. Theme-aware card dialog surface & header
 * 3. Accessible close button with localized label
 * 4. Hardware back press support
 */

import React, { type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radii, spacing } from '../../constants/theme';
import { useAppLanguage } from '../../i18n';
import { useAppTheme } from '../../theme';

export interface ModalWrapperProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

export function ModalWrapper({
  visible,
  onClose,
  title,
  children,
  testID = 'modal-wrapper',
  contentStyle,
}: ModalWrapperProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const closeLabel = t('common.close', 'Đóng');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <Pressable
          style={styles.backdropPressable}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            contentStyle,
          ]}
        >
          {title ? (
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={spacing.sm}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                testID="modal-close-btn"
                style={styles.closeButton}
              >
                <Text style={[styles.closeIcon, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.body}>{children}</View>
        </View>
      </View>
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
  backdropPressable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    padding: spacing.lg,
  },
});

export default ModalWrapper;
