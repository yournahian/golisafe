import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  trust_score: number;
  is_trusted: boolean;
}

export interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser) => void;
  isDark?: boolean;
  language?: 'en' | 'bn';
}

const UI_TEXT = {
  en: {
    loginTab: 'Sign In',
    signupTab: 'Create Account',
    titleLogin: 'Welcome Back',
    subtitleLogin: 'Sign in to access your trusted guardian reputation.',
    titleSignup: 'Join GoliSafe',
    subtitleSignup: 'Help make Dhaka streets safer for everyone.',
    nameLabel: 'Full Name',
    namePlaceholder: 'e.g. Arini Teresa',
    emailLabel: 'Email Address',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password (min 6 chars)',
    submitLogin: 'Sign In',
    submitSignup: 'Create Account',
    guestButton: 'Continue as Guest',
    guestHint: 'No account needed for basic hazard reporting',
    errFillAll: 'Please fill in all required fields.',
    errInvalidEmail: 'Please enter a valid email address.',
    errPasswordShort: 'Password must be at least 6 characters.',
  },
  bn: {
    loginTab: 'লগইন',
    signupTab: 'অ্যাকাউন্ট খুলুন',
    titleLogin: 'স্বাগতম',
    subtitleLogin: 'আপনার অভিভাবক রেপুটেশন ও প্রোফাইল অ্যাক্সেস করুন।',
    titleSignup: 'গোলিসেইফে যোগ দিন',
    subtitleSignup: 'ঢাকার রাস্তা সবার জন্য নিরাপদ করতে সহায়তা করুন।',
    nameLabel: 'পূর্ণ নাম',
    namePlaceholder: 'যেমন: আরিনি তেরেসা',
    emailLabel: 'ইমেইল ঠিকানা',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'পাসওয়ার্ড',
    passwordPlaceholder: 'পাসওয়ার্ড দিন (কমপক্ষে ৬ অক্ষর)',
    submitLogin: 'লগইন করুন',
    submitSignup: 'অ্যাকাউন্ট তৈরি করুন',
    guestButton: 'গেস্ট হিসেবে চালিয়ে যান',
    guestHint: 'জরুরি রিপোর্টের জন্য অ্যাকাউন্টের প্রয়োজন নেই',
    errFillAll: 'দয়া করে সব প্রয়োজনীয় তথ্য পূরণ করুন।',
    errInvalidEmail: 'সঠিক ইমেইল ঠিকানা প্রদান করুন।',
    errPasswordShort: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
  },
};

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  onClose,
  onAuthSuccess,
  isDark = true,
  language = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const copy = UI_TEXT[language] || UI_TEXT.en;

  const theme = isDark
    ? {
        backdrop: 'rgba(11, 17, 32, 0.78)',
        sheetBg: '#161D2C',
        cardBg: '#1E293B',
        cardBorder: '#334155',
        inputBg: '#131C31',
        inputBorder: '#263554',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        accent: '#3B82F6',
        accentSurface: 'rgba(59, 130, 246, 0.18)',
        tabActiveBg: '#1E293B',
        tabActiveText: '#60A5FA',
        tabInactiveText: '#94A3B8',
        guestBtnBg: 'transparent',
        guestBtnBorder: '#334155',
        guestBtnText: '#CBD5E1',
        closeBtnBg: '#1E293B',
        closeBtnBorder: '#334155',
        closeBtnText: '#F1F5F9',
        errorBg: 'rgba(239, 68, 68, 0.18)',
        errorBorder: 'rgba(248, 113, 113, 0.45)',
        errorText: '#FCA5A5',
      }
    : {
        backdrop: 'rgba(15, 23, 42, 0.45)',
        sheetBg: '#FFFFFF',
        cardBg: '#F8FAFC',
        cardBorder: '#E2E8F0',
        inputBg: '#FFFFFF',
        inputBorder: '#CBD5E1',
        textPrimary: '#0F172A',
        textSecondary: '#64748B',
        accent: '#2563EB',
        accentSurface: '#EFF6FF',
        tabActiveBg: '#FFFFFF',
        tabActiveText: '#2563EB',
        tabInactiveText: '#64748B',
        guestBtnBg: '#F1F5F9',
        guestBtnBorder: '#E2E8F0',
        guestBtnText: '#475569',
        closeBtnBg: '#F1F5F9',
        closeBtnBorder: '#CBD5E1',
        closeBtnText: '#64748B',
        errorBg: '#FEF2F2',
        errorBorder: '#FECACA',
        errorText: '#DC2626',
      };

  const validate = (): boolean => {
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      setErrorMessage(copy.errFillAll);
      return false;
    }
    if (activeTab === 'signup' && !displayName.trim()) {
      setErrorMessage(copy.errFillAll);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage(copy.errInvalidEmail);
      return false;
    }
    if (password.length < 6) {
      setErrorMessage(copy.errPasswordShort);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      // Simulate authentication API delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      const authenticatedUser: AuthUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: email.trim().toLowerCase(),
        display_name:
          activeTab === 'signup'
            ? displayName.trim()
            : email.split('@')[0],
        trust_score: activeTab === 'signup' ? 15 : 42,
        is_trusted: false,
      };

      onAuthSuccess(authenticatedUser);
      onClose();
    } catch {
      setErrorMessage('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestContinue = () => {
    const guestUser: AuthUser = {
      id: 'guest_' + Math.random().toString(36).substring(2, 9),
      email: 'guest@golisafe.local',
      display_name: 'Guest Citizen',
      trust_score: 5,
      is_trusted: false,
    };
    onAuthSuccess(guestUser);
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

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
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
              style={[
                styles.dragHandle,
                { backgroundColor: theme.cardBorder },
              ]}
            />

            {/* Header with Title and Close Button */}
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  {activeTab === 'login' ? copy.titleLogin : copy.titleSignup}
                </Text>
                <Text
                  style={[styles.subtitle, { color: theme.textSecondary }]}
                >
                  {activeTab === 'login'
                    ? copy.subtitleLogin
                    : copy.subtitleSignup}
                </Text>
              </View>

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
                accessibilityLabel="Close auth modal"
              >
                <Text
                  style={[styles.closeButtonText, { color: theme.closeBtnText }]}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Switcher: Sign In vs Create Account */}
            <View
              style={[
                styles.tabContainer,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'login' && {
                    backgroundColor: theme.tabActiveBg,
                    borderColor: theme.accent,
                  },
                ]}
                onPress={() => {
                  setActiveTab('login');
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        activeTab === 'login'
                          ? theme.tabActiveText
                          : theme.tabInactiveText,
                      fontWeight: activeTab === 'login' ? '700' : '500',
                    },
                  ]}
                >
                  {copy.loginTab}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'signup' && {
                    backgroundColor: theme.tabActiveBg,
                    borderColor: theme.accent,
                  },
                ]}
                onPress={() => {
                  setActiveTab('signup');
                  setErrorMessage(null);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color:
                        activeTab === 'signup'
                          ? theme.tabActiveText
                          : theme.tabInactiveText,
                      fontWeight: activeTab === 'signup' ? '700' : '500',
                    },
                  ]}
                >
                  {copy.signupTab}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Optional Error Banner */}
              {errorMessage && (
                <View
                  style={[
                    styles.errorBanner,
                    {
                      backgroundColor: theme.errorBg,
                      borderColor: theme.errorBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={theme.errorText}
                  />
                  <Text
                    style={[styles.errorBannerText, { color: theme.errorText }]}
                  >
                    {errorMessage}
                  </Text>
                </View>
              )}

              {/* Signup: Full Name */}
              {activeTab === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text
                    style={[styles.inputLabel, { color: theme.textSecondary }]}
                  >
                    {copy.nameLabel}
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={theme.textSecondary}
                    />
                    <TextInput
                      style={[styles.textInput, { color: theme.textPrimary }]}
                      placeholder={copy.namePlaceholder}
                      placeholderTextColor={theme.textSecondary}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              {/* Email Address */}
              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: theme.textSecondary }]}
                >
                  {copy.emailLabel}
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary }]}
                    placeholder={copy.emailPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password with Eye Toggle */}
              <View style={styles.inputGroup}>
                <Text
                  style={[styles.inputLabel, { color: theme.textSecondary }]}
                >
                  {copy.passwordLabel}
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.textInput, { color: theme.textPrimary }]}
                    placeholder={copy.passwordPlaceholder}
                    placeholderTextColor={theme.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.accent },
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        activeTab === 'login'
                          ? 'log-in-outline'
                          : 'person-add-outline'
                      }
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.submitButtonText}>
                      {activeTab === 'login'
                        ? copy.submitLogin
                        : copy.submitSignup}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: theme.cardBorder },
                  ]}
                />
                <Text
                  style={[styles.dividerText, { color: theme.textSecondary }]}
                >
                  or
                </Text>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: theme.cardBorder },
                  ]}
                />
              </View>

              {/* Continue as Guest Button */}
              <TouchableOpacity
                style={[
                  styles.guestButton,
                  {
                    backgroundColor: theme.guestBtnBg,
                    borderColor: theme.guestBtnBorder,
                  },
                ]}
                onPress={handleGuestContinue}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="shield-outline"
                  size={18}
                  color={theme.guestBtnText}
                />
                <Text
                  style={[styles.guestButtonText, { color: theme.guestBtnText }]}
                >
                  {copy.guestButton}
                </Text>
              </TouchableOpacity>

              <Text
                style={[styles.guestHintText, { color: theme.textSecondary }]}
              >
                {copy.guestHint}
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  keyboardContainer: {
    width: '100%',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabButtonText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11.5,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  guestButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guestButtonText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  guestHintText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -4,
  },
});

export default AuthModal;
