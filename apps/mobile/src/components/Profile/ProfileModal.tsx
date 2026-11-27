import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../AppIcon';

export interface ProfileUser {
  id?: string;
  email?: string;
  display_name?: string;
  trust_score?: number;
  is_trusted?: boolean;
}

export interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: ProfileUser | null;
  totalReportsCount?: number;
  onSignOut?: () => void;
  isDark?: boolean;
  language?: 'en' | 'bn';
}

const UI_TEXT = {
  en: {
    title: 'Citizen Profile',
    guestTitle: 'Guest Citizen',
    guestEmail: 'Unregistered user',
    trustedBadge: '🛡️ Trusted Guardian',
    contributorBadge: '🌱 Community Contributor',
    guardianReq: 'Reach 50 Trust Score to earn Trusted Guardian status',
    guardianActiveDesc:
      'Your hazard reports carry 2x verification weight across Dhaka.',
    trustScoreLabel: 'TRUST SCORE',
    trustScoreLevel: 'Guardian Level',
    reportsLabel: 'Reports Submitted',
    confirmedVotesLabel: 'Community Impact',
    highAccuracyBadge: 'High Reliability',
    signOutBtn: 'Sign Out',
    switchAccountBtn: 'Switch Account',
  },
  bn: {
    title: 'নাগরিক প্রোফাইল',
    guestTitle: 'গেস্ট নাগরিক',
    guestEmail: 'অনিবন্ধিত ইউজার',
    trustedBadge: '🛡️ বিশ্বস্ত অভিভাবক',
    contributorBadge: '🌱 কমিউনিটি সাহায্যকারী',
    guardianReq: '৫০ ট্রাস্ট স্কোর অর্জন করে বিশ্বস্ত অভিভাবক ব্যাজ পান',
    guardianActiveDesc:
      'আপনার রিপোর্টসমূহ সমগ্র ঢাকায় ২ গুণ দ্রুত যাচাইকৃত হিসেবে গণ্য হয়।',
    trustScoreLabel: 'ট্রাস্ট স্কোর',
    trustScoreLevel: 'অভিভাবক পর্যায়',
    reportsLabel: 'মোট রিপোর্ট জমা',
    confirmedVotesLabel: 'কমিউনিটি অবদান',
    highAccuracyBadge: 'উচ্চ নির্ভরযোগ্যতা',
    signOutBtn: 'লগআউট',
    switchAccountBtn: 'অ্যাকাউন্ট পরিবর্তন',
  },
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  user,
  totalReportsCount = 0,
  onSignOut,
  isDark = true,
  language = 'en',
}) => {
  const copy = UI_TEXT[language] || UI_TEXT.en;

  const trustScore = Math.max(0, Math.min(100, user?.trust_score ?? 15));
  const isTrusted = trustScore >= 50 || Boolean(user?.is_trusted);

  const theme = isDark
    ? {
        backdrop: 'rgba(11, 17, 32, 0.78)',
        sheetBg: '#161D2C',
        cardBg: '#1E293B',
        cardBorder: '#334155',
        statBg: '#131C31',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        accent: '#3B82F6',
        accentSurface: 'rgba(59, 130, 246, 0.18)',
        trustedGold: '#F59E0B',
        trustedGoldBg: 'rgba(245, 158, 11, 0.16)',
        trustedGoldBorder: '#F59E0B',
        trustedGreen: '#10B981',
        trustedGreenBg: 'rgba(16, 185, 129, 0.16)',
        trustedGreenBorder: 'rgba(16, 185, 129, 0.4)',
        progressBarBg: '#263554',
        progressBarFill: isTrusted ? '#10B981' : '#3B82F6',
        closeBtnBg: '#1E293B',
        closeBtnBorder: '#334155',
        closeBtnText: '#F1F5F9',
        signOutBg: 'rgba(239, 68, 68, 0.14)',
        signOutBorder: 'rgba(239, 68, 68, 0.35)',
        signOutText: '#FCA5A5',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.45)',
        sheetBg: '#FFFFFF',
        cardBg: '#F8FAFC',
        cardBorder: '#E2E8F0',
        statBg: '#F1F5F9',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        accent: '#2563EB',
        accentSurface: '#EFF6FF',
        trustedGold: '#D97706',
        trustedGoldBg: '#FEF3C7',
        trustedGoldBorder: '#FBBF24',
        trustedGreen: '#059669',
        trustedGreenBg: '#D1FAE5',
        trustedGreenBorder: '#6EE7B7',
        progressBarBg: '#E2E8F0',
        progressBarFill: isTrusted ? '#059669' : '#2563EB',
        closeBtnBg: '#F1F5F9',
        closeBtnBorder: '#CBD5E1',
        closeBtnText: '#64748B',
        signOutBg: '#FEF2F2',
        signOutBorder: '#FECACA',
        signOutText: '#DC2626',
      };

  const displayName =
    user?.display_name?.trim() || copy.guestTitle;
  const email = user?.email?.trim() || copy.guestEmail;

  const handleSignOutPress = () => {
    onSignOut?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: theme.backdrop }]}>
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.sheetBg,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Top Sheet Drag Indicator */}
          <View
            style={[styles.dragHandle, { backgroundColor: theme.cardBorder }]}
          />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
              {copy.title}
            </Text>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: theme.closeBtnBg,
                  borderColor: theme.closeBtnBorder,
                },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close profile modal"
            >
              <Text
                style={[styles.closeButtonText, { color: theme.closeBtnText }]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* User Avatar & Info Card */}
            <View
              style={[
                styles.userCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: isTrusted
                    ? theme.trustedGoldBorder
                    : theme.cardBorder,
                },
              ]}
            >
              <View style={styles.avatarRow}>
                <View
                  style={[
                    styles.avatarCircle,
                    {
                      backgroundColor: isTrusted
                        ? theme.trustedGoldBg
                        : theme.accentSurface,
                      borderColor: isTrusted
                        ? theme.trustedGold
                        : theme.accent,
                    },
                  ]}
                >
                  <AppIcon
                    name={isTrusted ? 'shield-checkmark' : 'person'}
                    size={32}
                    color={isTrusted ? theme.trustedGold : theme.accent}
                  />
                </View>

                <View style={styles.userInfo}>
                  <Text
                    style={[styles.userName, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  <Text
                    style={[styles.userEmail, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {email}
                  </Text>
                </View>
              </View>

              {/* Trusted Guardian Badge or Contributor Status */}
              <View
                style={[
                  styles.badgeBanner,
                  {
                    backgroundColor: isTrusted
                      ? theme.trustedGoldBg
                      : theme.statBg,
                    borderColor: isTrusted
                      ? theme.trustedGoldBorder
                      : theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.badgeHeader}>
                  <Text
                    style={[
                      styles.badgeTitle,
                      {
                        color: isTrusted
                          ? theme.trustedGold
                          : theme.textPrimary,
                      },
                    ]}
                  >
                    {isTrusted ? copy.trustedBadge : copy.contributorBadge}
                  </Text>
                  {isTrusted && (
                    <View
                      style={[
                        styles.verifiedPill,
                        {
                          backgroundColor: theme.trustedGreenBg,
                          borderColor: theme.trustedGreenBorder,
                        },
                      ]}
                    >
                      <AppIcon
                        name="checkmark-circle"
                        size={12}
                        color={theme.trustedGreen}
                      />
                      <Text
                        style={[
                          styles.verifiedPillText,
                          { color: theme.trustedGreen },
                        ]}
                      >
                        {copy.highAccuracyBadge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.badgeDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  {isTrusted ? copy.guardianActiveDesc : copy.guardianReq}
                </Text>
              </View>
            </View>

            {/* Trust Score Progress Bar Section */}
            <View
              style={[
                styles.scoreCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.scoreHeaderRow}>
                <View style={styles.scoreLabelGroup}>
                  <Text
                    style={[
                      styles.scoreSectionLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {copy.trustScoreLabel}
                  </Text>
                  <Text
                    style={[
                      styles.scoreSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {isTrusted ? 'Verified 2x Multiplier' : 'Community Tier 1'}
                  </Text>
                </View>
                <View style={styles.scoreNumberGroup}>
                  <Text
                    style={[
                      styles.scoreValue,
                      {
                        color: isTrusted
                          ? theme.trustedGreen
                          : theme.accent,
                      },
                    ]}
                  >
                    {trustScore}
                  </Text>
                  <Text
                    style={[
                      styles.scoreTotal,
                      { color: theme.textSecondary },
                    ]}
                  >
                    /100
                  </Text>
                </View>
              </View>

              {/* Visual Progress Bar */}
              <View
                style={[
                  styles.progressTrack,
                  { backgroundColor: theme.progressBarBg },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${trustScore}%`,
                      backgroundColor: theme.progressBarFill,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Statistics / Impact Grid */}
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <AppIcon
                  name="megaphone-outline"
                  size={22}
                  color={theme.accent}
                />
                <Text
                  style={[styles.statNumber, { color: theme.textPrimary }]}
                >
                  {totalReportsCount}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  {copy.reportsLabel}
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <AppIcon
                  name="shield-checkmark-outline"
                  size={22}
                  color={theme.trustedGreen}
                />
                <Text
                  style={[styles.statNumber, { color: theme.textPrimary }]}
                >
                  {isTrusted ? 'High' : 'Normal'}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  {copy.confirmedVotesLabel}
                </Text>
              </View>
            </View>

            {/* Sign Out / Switch Account Button */}
            <TouchableOpacity
              style={[
                styles.signOutButton,
                {
                  backgroundColor: theme.signOutBg,
                  borderColor: theme.signOutBorder,
                },
              ]}
              onPress={handleSignOutPress}
              activeOpacity={0.8}
            >
              <AppIcon
                name="log-out-outline"
                size={18}
                color={theme.signOutText}
              />
              <Text
                style={[styles.signOutButtonText, { color: theme.signOutText }]}
              >
                {copy.signOutBtn}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '88%',
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 24,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  userCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
  },
  userEmail: {
    fontSize: 13,
  },
  badgeBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabelGroup: {
    gap: 2,
  },
  scoreSectionLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scoreSubtitle: {
    fontSize: 12,
  },
  scoreNumberGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  scoreTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  signOutButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileModal;
