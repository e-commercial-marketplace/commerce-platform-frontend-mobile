/**
 * Presentation Helpers for Admin Portal.
 *
 * Centralizes theme-aware badges and localized status mappings for:
 * - Roles (CUSTOMER, SELLER, ADMIN)
 * - Seller Status (PENDING, APPROVED, SUSPENDED, REJECTED)
 * - User Account Status (enabled / disabled)
 * - Carrier Status (active / inactive)
 * - Voucher Derived Status (ACTIVE, NOT_YET_VALID, EXPIRED, USAGE_LIMIT_REACHED)
 *
 * Maintains backward compatibility with legacy string fallbacks while providing
 * WCAG-compliant contrast in both Light and Dark themes.
 */

import type { SellerStatus } from '../types/adminApi';
import type { Role } from '../types/auth';

export type VoucherDerivedStatus =
  | 'ACTIVE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'USAGE_LIMIT_REACHED';

export type StatusBadgePresentation = {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon?: string;
};

export type TranslateFn = (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;

/**
 * Returns theme-safe badge configuration for user roles.
 */
export function getRoleBadgeConfig(
  role: Role,
  t: TranslateFn,
  isDark = false,
): StatusBadgePresentation {
  switch (role) {
    case 'CUSTOMER':
      return {
        label: t('admin.enums.role.customer', 'Customer'),
        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#EFF8FF',
        textColor: isDark ? '#38BDF8' : '#175CD3',
      };
    case 'SELLER':
      return {
        label: t('admin.enums.role.seller', 'Seller'),
        backgroundColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#F9F5FF',
        textColor: isDark ? '#C084FC' : '#6941C6',
      };
    case 'ADMIN':
      return {
        label: t('admin.enums.role.admin', 'Admin'),
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F2F4F7',
        textColor: isDark ? '#E2E8F0' : '#344054',
      };
    default:
      return {
        label: role,
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F2F4F7',
        textColor: isDark ? '#E2E8F0' : '#344054',
      };
  }
}

/**
 * Returns theme-safe badge configuration for seller approval status.
 */
export function getSellerStatusBadgeConfig(
  status: SellerStatus,
  t: TranslateFn,
  isDark = false,
): StatusBadgePresentation {
  switch (status) {
    case 'PENDING':
      return {
        label: t('admin.enums.sellerStatus.pending', 'Pending'),
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF0C7',
        textColor: isDark ? '#FBBF24' : '#B54708',
      };
    case 'APPROVED':
      return {
        label: t('admin.enums.sellerStatus.approved', 'Approved'),
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF3',
        textColor: isDark ? '#34D399' : '#027A48',
      };
    case 'SUSPENDED':
      return {
        label: t('admin.enums.sellerStatus.suspended', 'Suspended'),
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF3F2',
        textColor: isDark ? '#F87171' : '#B42318',
      };
    case 'REJECTED':
      return {
        label: t('admin.enums.sellerStatus.rejected', 'Rejected'),
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F2F4F7',
        textColor: isDark ? '#94A3B8' : '#475467',
      };
    default:
      return {
        label: status,
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F2F4F7',
        textColor: isDark ? '#94A3B8' : '#475467',
      };
  }
}

/**
 * Returns theme-safe badge configuration for user account active/disabled status.
 */
export function getAccountStatusBadgeConfig(
  enabled: boolean,
  t: TranslateFn,
  isDark = false,
): StatusBadgePresentation {
  return enabled
    ? {
        label: t('admin.enums.accountStatus.active', 'Active'),
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF3',
        textColor: isDark ? '#34D399' : '#027A48',
      }
    : {
        label: t('admin.enums.accountStatus.disabled', 'Disabled'),
        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF3F2',
        textColor: isDark ? '#F87171' : '#B42318',
      };
}

/**
 * Returns theme-safe badge configuration for carrier active status.
 */
export function getCarrierStatusBadgeConfig(
  active: boolean,
  t: TranslateFn,
  isDark = false,
): StatusBadgePresentation {
  return active
    ? {
        label: t('admin.carriers.statusActive', '🟢 Active'),
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FADF',
        textColor: isDark ? '#34D399' : '#027A48',
      }
    : {
        label: t('admin.carriers.statusInactive', '⏹️ Suspended'),
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F2F4F7',
        textColor: isDark ? '#94A3B8' : '#475467',
      };
}

/**
 * Returns theme-safe badge configuration for voucher derived statuses.
 */
export function getVoucherStatusBadgeConfig(
  status: VoucherDerivedStatus,
  t: TranslateFn,
  isDark = false,
): StatusBadgePresentation {
  switch (status) {
    case 'ACTIVE':
      return {
        label: t('admin.enums.voucherStatus.active', 'Active'),
        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FADF',
        textColor: isDark ? '#34D399' : '#027A48',
        icon: '🟢',
      };
    case 'NOT_YET_VALID':
      return {
        label: t('admin.enums.voucherStatus.notYetValid', 'Not yet valid'),
        backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#EFF8FF',
        textColor: isDark ? '#38BDF8' : '#175CD3',
        icon: '⏳',
      };
    case 'EXPIRED':
      return {
        label: t('admin.enums.voucherStatus.expired', 'Expired'),
        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F2F4F7',
        textColor: isDark ? '#E2E8F0' : '#344054',
        icon: '⏹️',
      };
    case 'USAGE_LIMIT_REACHED':
      return {
        label: t('admin.enums.voucherStatus.usageLimitReached', 'Usage limit reached'),
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF0C7',
        textColor: isDark ? '#FBBF24' : '#B54708',
        icon: '⚠️',
      };
  }
}
