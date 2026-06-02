import { StatusBar } from 'expo-status-bar';
import { useFonts, Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold, Lexend_800ExtraBold, Lexend_900Black } from '@expo-google-fonts/lexend';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

type Route = 'welcome' | 'home' | 'apply';

type FieldStatus = 'pending' | 'success' | 'manual' | 'skipped';
type ScrollDirection = 'up' | 'down' | 'none';

type FormField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  status: FieldStatus;
  reason?: string;
  mappedValue?: string;
};

type WebMessage =
  | {
      type: 'PAGE_SCANNED';
      title: string;
      url: string;
      applyButtonFound: boolean;
      formFound: boolean;
      fieldCount: number;
      hiddenCount: number;
      fileCount: number;
      submitFound: boolean;
      captchaFound: boolean;
    }
  | { type: 'APPLY_FORM_OPENED'; url: string; formFound: boolean }
  | { type: 'FIELD_DETECTED'; fields: FormField[] }
  | { type: 'FIELD_FILLED'; id: string; label: string; fieldType: string; required: boolean; mappedValue?: string }
  | { type: 'FIELD_SKIPPED'; id: string; label: string; fieldType: string; required: boolean; reason: string }
  | { type: 'MANUAL_REQUIRED'; id: string; label: string; fieldType: string; required: boolean; reason: string }
  | { type: 'READY_FOR_REVIEW'; detected: number; filled: number; skipped: number; manual: number }
  | { type: 'FORM_RESET'; detected: number }
  | { type: 'SCROLL_STATE'; scrollY: number; direction: ScrollDirection; isNearTop: boolean };

type Command = 'scan' | 'preflightAutofill' | 'autofill' | 'resetForm' | 'focusField';

type Profile = {
  name: string;
  targetRole: string;
  email: string;
  phone: string;
  location: string;
  currentCompany: string;
  linkedIn: string;
  portfolio: string;
  github: string;
  workAuthorization: string;
  earliestStart: string;
  salaryExpectation: string;
  yearsExperience: string;
};

type ProfileKey = keyof Profile;

type ProfileFieldConfig = {
  key: ProfileKey;
  label: string;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url' | 'number-pad';
};

type FieldAnswers = Record<string, string>;

type MissingRequirement =
  | {
      id: string;
      kind: 'profile';
      label: string;
      profileKey: ProfileKey;
      placeholder: string;
      keyboardType?: ProfileFieldConfig['keyboardType'];
    }
  | {
      id: string;
      kind: 'field';
      label: string;
      fieldId: string;
      placeholder: string;
    };

const logo = require('./assets/optimhire/icon.png');
const aiIcon = require('./assets/optimhire/AI-icon.png');

const HEADER_TOP_OFFSET = 8;
const HEADER_MIN_HEIGHT = 96;
const HEADER_WEBVIEW_GAP = 8;
const HEADER_VISIBLE_SPACE = HEADER_TOP_OFFSET + HEADER_MIN_HEIGHT + HEADER_WEBVIEW_GAP + 8;
const HEADER_HIDE_AFTER_Y = 140;
const HEADER_SHOW_UP_DISTANCE = 36;
const HEADER_HIDE_DOWN_DISTANCE = 56;

const colors = {
  primary: '#0A6ED4',
  navy: '#004182',
  cta: '#0A6ED4',
  border: '#D8DDE0',
  background: '#F6F8FB',
  card: '#FFFFFF',
  text: '#252A37',
  muted: '#747B8A',
  soft: '#F1F6FF',
  success: '#4DBB7C',
  warning: '#DF9A25',
  error: '#D93A3A',
  errorBg: '#FFF2F2',
  successBg: '#E6F8F0',
  warningBg: '#FFF8EA',
};

const fonts = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
  bold: 'Lexend_700Bold',
  extraBold: 'Lexend_800ExtraBold',
  black: 'Lexend_900Black',
};

const liveJob = {
  title: 'React Native Engineer',
  company: 'Fliff',
  location: 'Sofia · Remote',
  ats: 'Lever',
  url: 'https://jobs.lever.co/Fliff/5962f55c-18ce-42f7-9bc9-7e9b22c05f30',
  applyUrl: 'https://jobs.lever.co/Fliff/5962f55c-18ce-42f7-9bc9-7e9b22c05f30/apply',
};

const initialProfile: Profile = {
  name: 'Alex Morgan',
  targetRole: 'React Native Developer',
  email: 'alex.morgan@example.com',
  phone: '+1 415 525 1604',
  location: 'Sofia, Bulgaria',
  currentCompany: 'OptimHire Labs',
  linkedIn: 'https://linkedin.com/in/alexmorgan',
  portfolio: 'https://alexmorgan.dev',
  github: 'https://github.com/alexmorgan',
  workAuthorization: 'Yes',
  earliestStart: '2026-07-01',
  salaryExpectation: '$125,000',
  yearsExperience: '5',
};

const profileFields: ProfileFieldConfig[] = [
  { key: 'name', label: 'Full name', placeholder: 'Add full name' },
  { key: 'email', label: 'Email', placeholder: 'Add email', keyboardType: 'email-address' },
  { key: 'phone', label: 'Phone', placeholder: 'Add phone number', keyboardType: 'phone-pad' },
  { key: 'location', label: 'Location', placeholder: 'Add location' },
  { key: 'currentCompany', label: 'Current company', placeholder: 'Add company' },
  { key: 'linkedIn', label: 'LinkedIn', placeholder: 'Add LinkedIn URL', keyboardType: 'url' },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'Add portfolio URL', keyboardType: 'url' },
  { key: 'github', label: 'GitHub', placeholder: 'Add GitHub URL', keyboardType: 'url' },
  { key: 'workAuthorization', label: 'Work authorization', placeholder: 'Yes / No' },
  { key: 'earliestStart', label: 'Start date', placeholder: 'YYYY-MM-DD' },
  { key: 'salaryExpectation', label: 'Salary', placeholder: 'Add salary expectation' },
  { key: 'yearsExperience', label: 'Years experience', placeholder: 'Add years', keyboardType: 'number-pad' },
];

const pocCapabilities = [
  'Live iOS WebView control',
  'Dynamic DOM field detection',
  'Profile-to-field mapping',
  'Safe autofill with review handoff',
];

const emptyStats = { detected: 0, filled: 0, manual: 0, skipped: 0 };

function profileKeyForField(field: Pick<FormField, 'id' | 'label'>): ProfileKey | null {
  const haystack = `${field.label} ${field.id}`.toLowerCase();

  if (/full\s*name|name-input|^name$/.test(haystack)) return 'name';
  if (/email/.test(haystack)) return 'email';
  if (/phone|mobile/.test(haystack)) return 'phone';
  if (/location|city|address/.test(haystack)) return 'location';
  if (/company|current employer|organization|org-input/.test(haystack)) return 'currentCompany';
  if (/linkedin/.test(haystack)) return 'linkedIn';
  if (/github/.test(haystack)) return 'github';
  if (/portfolio|website|personal site/.test(haystack)) return 'portfolio';
  if (/authorized|work authorization|visa/.test(haystack)) return 'workAuthorization';
  if (/start date|available|availability/.test(haystack)) return 'earliestStart';
  if (/salary|compensation|expected pay/.test(haystack)) return 'salaryExpectation';
  if (/years|experience/.test(haystack)) return 'yearsExperience';

  return null;
}

function profileLabelForKey(key: ProfileKey) {
  return profileFields.find((field) => field.key === key)?.label || key;
}

function profileConfigForKey(key: ProfileKey) {
  return profileFields.find((field) => field.key === key);
}

function staticAnswerForField(field: Pick<FormField, 'id' | 'label'>) {
  const haystack = `${field.label} ${field.id}`.toLowerCase();

  if (/european time zone|cet|timezone/.test(haystack)) {
    return 'Yes, I can work CET +/-2 hours.';
  }

  if (/gambling|gaming/.test(haystack)) {
    return '2 years of adjacent gaming/product experience; open to ramping quickly in regulated online gambling.';
  }

  if (/why.*interested|cover letter|tell us/.test(haystack)) {
    return 'I am interested because the role combines React Native architecture, product automation, and user-focused mobile workflows.';
  }

  return '';
}

function valueForDetectedField(field: FormField, profile: Profile, fieldAnswers: FieldAnswers) {
  const profileKey = profileKeyForField(field);

  if (profileKey) {
    return profile[profileKey].trim();
  }

  return (fieldAnswers[field.id] || staticAnswerForField(field)).trim();
}

function isFillableTextLikeField(field: FormField) {
  return ['text', 'textarea', 'email', 'tel', 'phone', 'url', 'number', 'date', 'select', 'radio', 'checkbox'].includes(
    field.type.toLowerCase(),
  );
}

function looksLikeCustomApplicationQuestion(field: Pick<FormField, 'id' | 'label' | 'type'>) {
  const haystack = `${field.label} ${field.id}`.toLowerCase();

  return (
    field.type.toLowerCase() === 'textarea' ||
    /\?$/.test(field.label.trim()) ||
    /why|tell us|describe|explain|cover letter|motivation|interested|available|authorized|sponsor|timezone|relocat|salary|compensation|notice|experience/i.test(
      haystack,
    )
  );
}

function shouldAskBeforeAutofill(field: FormField, profile: Profile, fieldAnswers: FieldAnswers) {
  if (!shouldTrackPreflightField(field) || valueForDetectedField(field, profile, fieldAnswers)) {
    return false;
  }

  return true;
}

function shouldTrackPreflightField(field: FormField) {
  return field.type !== 'file' && isFillableTextLikeField(field) && (field.required || looksLikeCustomApplicationQuestion(field));
}

function getMissingRequirements(fields: FormField[], profile: Profile, fieldAnswers: FieldAnswers) {
  const requirements: MissingRequirement[] = [];
  const seen = new Set<string>();

  fields.forEach((field) => {
    if (!shouldAskBeforeAutofill(field, profile, fieldAnswers)) {
      return;
    }

    const profileKey = profileKeyForField(field);

    if (profileKey) {
      const config = profileConfigForKey(profileKey);
      const id = `profile:${profileKey}`;

      if (!seen.has(id)) {
        requirements.push({
          id,
          kind: 'profile',
          label: config?.label || profileLabelForKey(profileKey),
          profileKey,
          placeholder: config?.placeholder || `Add ${profileLabelForKey(profileKey)}`,
          keyboardType: config?.keyboardType,
        });
        seen.add(id);
      }

      return;
    }

    const id = `field:${field.id}`;

    if (!seen.has(id)) {
      requirements.push({
        id,
        kind: 'field',
        label: field.label || 'Required question',
        fieldId: field.id,
        placeholder: 'Add answer',
      });
      seen.add(id);
    }
  });

  return requirements;
}

function valueForRequirement(requirement: MissingRequirement, profile: Profile, fieldAnswers: FieldAnswers) {
  if (requirement.kind === 'profile') {
    return profile[requirement.profileKey].trim();
  }

  return (fieldAnswers[requirement.fieldId] || '').trim();
}

function getIncompleteRequirements(requirements: MissingRequirement[], profile: Profile, fieldAnswers: FieldAnswers) {
  return requirements.filter((requirement) => !valueForRequirement(requirement, profile, fieldAnswers));
}

function markMissingProfileFields(fields: FormField[], profile: Profile) {
  return fields.map((field) => {
    const profileKey = profileKeyForField(field);

    if (!profileKey || profile[profileKey].trim()) {
      return field.status === 'manual' && field.reason?.startsWith('Add ')
        ? { ...field, status: 'pending' as FieldStatus, reason: undefined }
        : field;
    }

    return {
      ...field,
      status: 'manual' as FieldStatus,
      reason: `Add ${profileLabelForKey(profileKey)}`,
    };
  });
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
    Lexend_900Black,
  });
  const [route, setRoute] = useState<Route>('welcome');
  const [webViewUrl, setWebViewUrl] = useState(liveJob.url);
  const [webViewKey, setWebViewKey] = useState(1);
  const [status, setStatus] = useState('Ready to demonstrate live WebView automation.');
  const [diagnostic, setDiagnostic] = useState('Open the live Lever job, scan the page, then run JS autofill.');
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [fieldAnswers, setFieldAnswers] = useState<FieldAnswers>({});
  const [fields, setFields] = useState<FormField[]>([]);
  const [stats, setStats] = useState(emptyStats);
  const [reviewReady, setReviewReady] = useState(false);
  const [pendingAutofill, setPendingAutofill] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [assistantRequirements, setAssistantRequirements] = useState<MissingRequirement[]>([]);
  const [headerVisible, setHeaderVisible] = useState(true);
  const webViewRef = useRef<WebView>(null);
  const headerVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const lastScrollDirectionRef = useRef<ScrollDirection>('none');
  const accumulatedScrollDistanceRef = useRef(0);

  const missingRequirements = useMemo(
    () => getMissingRequirements(fields, profile, fieldAnswers),
    [fieldAnswers, fields, profile],
  );

  const requiredTotal = useMemo(
    () => fields.filter(shouldTrackPreflightField).length,
    [fields],
  );
  const requiredDone = useMemo(
    () => fields.filter((field) => shouldTrackPreflightField(field) && field.status === 'success').length,
    [fields],
  );

  const resetDemo = () => {
    setStatus('Resetting current form...');
    setDiagnostic('Clearing fields on the current page without navigating away.');
    setStats(emptyStats);
    setReviewReady(false);
    setPendingAutofill(false);
    setAssistantVisible(false);
    setAssistantRequirements([]);
    webViewRef.current?.injectJavaScript(liveLeverAutomationScript('resetForm', profile, fieldAnswers));
  };

  const updateProfile = (key: ProfileKey, value: string) => {
    setProfile((current) => {
      const next = { ...current, [key]: value };
      setFields((items) => markMissingProfileFields(items, next));
      return next;
    });
  };

  const runCommand = (command: Extract<Command, 'scan'>) => {
    if (command === 'scan') {
      setStatus('Scanning live DOM...');
    }
    webViewRef.current?.injectJavaScript(liveLeverAutomationScript(command, profile, fieldAnswers));
  };

  const focusWebViewField = (fieldId: string) => {
    webViewRef.current?.injectJavaScript(liveLeverAutomationScript('focusField', profile, fieldAnswers, fieldId));
  };

  const startAutofillFlow = () => {
    setStatus('Checking form requirements before autofill...');
    setDiagnostic('Scanning the form before filling anything.');
    setFields([]);
    setStats(emptyStats);
    setReviewReady(false);
    setPendingAutofill(true);
    setAssistantVisible(false);
    setAssistantRequirements([]);
    webViewRef.current?.injectJavaScript(liveLeverAutomationScript('preflightAutofill', profile, fieldAnswers));
  };

  const updateFieldAnswer = (fieldId: string, value: string) => {
    setFieldAnswers((current) => ({ ...current, [fieldId]: value }));
  };

  const continueAutofill = () => {
    const remaining = getIncompleteRequirements(assistantRequirements, profile, fieldAnswers);

    if (remaining.length > 0) {
      setStatus('Complete missing info');
      setDiagnostic(`We need ${remaining.length} ${remaining.length === 1 ? 'detail' : 'details'} before autofill.`);
      setAssistantVisible(true);
      return;
    }

    setAssistantVisible(false);
    setAssistantRequirements([]);
    setPendingAutofill(false);
    setReviewReady(false);
    setStatus('Autofilling form...');
    setDiagnostic('Using updated user info and form answers.');
    webViewRef.current?.injectJavaScript(liveLeverAutomationScript('autofill', profile, fieldAnswers));
  };

  const upsertField = (incoming: FormField) => {
    setFields((items) => {
      const exists = items.some((field) => field.id === incoming.id);
      const next = exists
        ? items.map((field) => (field.id === incoming.id ? { ...field, ...incoming } : field))
        : [...items, incoming];
      const markedNext = markMissingProfileFields(next, profile);
      setStats({
        detected: markedNext.length,
        filled: markedNext.filter((field) => field.status === 'success').length,
        manual: markedNext.filter((field) => field.status === 'manual').length,
        skipped: markedNext.filter((field) => field.status === 'skipped').length,
      });
      return markedNext;
    });
  };

  const updateHeaderVisibility = (nextVisible: boolean) => {
    if (headerVisibleRef.current === nextVisible) {
      return;
    }

    headerVisibleRef.current = nextVisible;
    setHeaderVisible(nextVisible);
  };

  const handleScrollState = (message: Extract<WebMessage, { type: 'SCROLL_STATE' }>) => {
    const previousY = lastScrollYRef.current;
    const y = Math.max(0, message.scrollY);

    if (y <= 24) {
      updateHeaderVisibility(true);
      lastScrollYRef.current = y;
      lastScrollDirectionRef.current = 'none';
      accumulatedScrollDistanceRef.current = 0;
      return;
    }

    if (message.direction === 'none') {
      lastScrollYRef.current = y;
      return;
    }

    if (lastScrollDirectionRef.current !== message.direction) {
      accumulatedScrollDistanceRef.current = 0;
      lastScrollDirectionRef.current = message.direction;
    }

    accumulatedScrollDistanceRef.current += Math.abs(y - previousY);
    lastScrollYRef.current = y;

    if (
      message.direction === 'down' &&
      headerVisibleRef.current &&
      y > HEADER_HIDE_AFTER_Y &&
      accumulatedScrollDistanceRef.current >= HEADER_HIDE_DOWN_DISTANCE
    ) {
      updateHeaderVisibility(false);
      accumulatedScrollDistanceRef.current = 0;
      return;
    }

    if (
      message.direction === 'up' &&
      !headerVisibleRef.current &&
      accumulatedScrollDistanceRef.current >= HEADER_SHOW_UP_DISTANCE
    ) {
      updateHeaderVisibility(true);
      accumulatedScrollDistanceRef.current = 0;
    }
  };

  const handleWebMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as WebMessage;

      if (message.type === 'PAGE_SCANNED') {
        setStatus(`Page scanned: ${message.fieldCount} fields detected`);
        setDiagnostic(
          `${message.formFound ? 'Application form visible' : 'Job page visible'} · ${message.fileCount} file upload · ${message.hiddenCount} hidden inputs · captcha ${message.captchaFound ? 'present' : 'not detected'} · submit ${message.submitFound ? 'found' : 'not found'}`,
        );
        setStats((value) => ({ ...value, detected: message.fieldCount + message.fileCount }));
        return;
      }

      if (message.type === 'APPLY_FORM_OPENED') {
        setStatus(message.formFound ? 'Apply form is already open' : 'Navigating to Lever apply form...');
        setDiagnostic(message.url);
        return;
      }

      if (message.type === 'FIELD_DETECTED') {
        const markedFields = markMissingProfileFields(message.fields, profile);
        const missing = getMissingRequirements(markedFields, profile, fieldAnswers);

        setFields(markedFields);
        setStats((value) => ({
          ...value,
          detected: markedFields.length,
          manual: markedFields.filter((field) => field.status === 'manual').length,
        }));

        if (pendingAutofill && missing.length > 0) {
          setStatus('Complete missing info');
          setDiagnostic(`We need ${missing.length} ${missing.length === 1 ? 'detail' : 'details'} before autofill.`);
          setAssistantRequirements(missing);
          setAssistantVisible(true);
          return;
        }

        if (pendingAutofill) {
          setPendingAutofill(false);
          setAssistantVisible(false);
          setAssistantRequirements([]);
          setStatus('Autofilling form...');
          setDiagnostic('Using saved user info and form answers.');
          webViewRef.current?.injectJavaScript(liveLeverAutomationScript('autofill', profile, fieldAnswers));
        }
        return;
      }

      if (message.type === 'FIELD_FILLED') {
        upsertField({
          id: message.id,
          label: message.label,
          type: message.fieldType,
          required: message.required,
          status: 'success',
          mappedValue: message.mappedValue,
        });
        return;
      }

      if (message.type === 'FIELD_SKIPPED') {
        upsertField({
          id: message.id,
          label: message.label,
          type: message.fieldType,
          required: message.required,
          status: 'skipped',
          reason: message.reason,
        });
        return;
      }

      if (message.type === 'MANUAL_REQUIRED') {
        upsertField({
          id: message.id,
          label: message.label,
          type: message.fieldType,
          required: message.required,
          status: 'manual',
          reason: message.reason,
        });
        return;
      }

      if (message.type === 'READY_FOR_REVIEW') {
        setReviewReady(true);
        setPendingAutofill(false);
        setAssistantVisible(false);
        setAssistantRequirements([]);
        setStatus(message.manual > 0 ? 'Review red fields manually' : 'Form filled');
        setDiagnostic(
          message.manual > 0
            ? `${message.manual} field${message.manual === 1 ? '' : 's'} need manual input in the WebView.`
            : 'Review and submit the form. Final submit was not clicked by the POC.',
        );
        setStats({
          detected: message.detected,
          filled: message.filled,
          manual: message.manual,
          skipped: message.skipped,
        });
      }

      if (message.type === 'FORM_RESET') {
        setStatus('Current form reset');
        setDiagnostic('The page stayed in place and form fields were cleared.');
        setReviewReady(false);
        setFields([]);
        setStats((value) => ({ ...value, detected: message.detected, filled: 0, manual: 0, skipped: 0 }));
        return;
      }

      if (message.type === 'SCROLL_STATE') {
        handleScrollState(message);
      }
    } catch {
      setStatus('Unable to parse WebView message');
    }
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          <View style={styles.welcome}>
            <Image source={logo} style={styles.heroLogo} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        {route === 'welcome' ? (
          <WelcomeScreen onContinue={() => setRoute('home')} />
        ) : route === 'home' ? (
          <ControlCenter profile={profile} onUpdateProfile={updateProfile} onStart={() => setRoute('apply')} />
        ) : (
          <LiveApplyScreen
            webViewKey={webViewKey}
            webViewUrl={webViewUrl}
            status={status}
            diagnostic={diagnostic}
            stats={stats}
            requiredDone={requiredDone}
            requiredTotal={requiredTotal}
            reviewReady={reviewReady}
            fields={fields}
            profile={profile}
            fieldAnswers={fieldAnswers}
            missingRequirements={missingRequirements}
            assistantVisible={assistantVisible}
            assistantRequirements={assistantRequirements}
            headerVisible={headerVisible}
            webViewRef={webViewRef}
            onUpdateProfile={updateProfile}
            onUpdateFieldAnswer={updateFieldAnswer}
            onContinueAutofill={continueAutofill}
            onBack={() => setRoute('home')}
            onScan={() => runCommand('scan')}
            onAutofill={startAutofillFlow}
            onReset={resetDemo}
            onFocusField={focusWebViewField}
            onMessage={handleWebMessage}
            onLoad={(url) => {
              setStatus('Live page loaded');
              setDiagnostic(url || webViewUrl);
            }}
            onError={(message) => {
              setStatus('WebView page error');
              setDiagnostic(message);
            }}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={styles.welcome}>
      <Image source={logo} style={styles.heroLogo} />
      <Text style={styles.wordmark}>OptimHire</Text>
      <Text style={styles.heroTitle}>Job Auto-Applier Mobile POC</Text>
      <Text style={styles.heroCopy}>Live iOS WebView automation for scanning and filling job application forms.</Text>
      <View style={styles.capabilityGrid}>
        {pocCapabilities.map((item) => (
          <View key={item} style={styles.capabilityChip}>
            <Text style={styles.capabilityText}>{item}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.primaryButton} onPress={onContinue}>
        <Text style={styles.primaryButtonText}>Continue with Demo</Text>
      </Pressable>
    </View>
  );
}

function ControlCenter({
  profile,
  onUpdateProfile,
  onStart,
}: {
  profile: Profile;
  onUpdateProfile: (key: ProfileKey, value: string) => void;
  onStart: () => void;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.brandHeader}>
        <Image source={logo} style={styles.headerLogo} />
        <View>
          <Text style={styles.kicker}>Review & Apply Mode</Text>
          <Text style={styles.headerTitle}>OptimHire Control Center</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>{profile.name || 'Candidate profile'}</Text>
            <Text style={styles.muted}>{profile.targetRole || 'Target role not set'}</Text>
            <Text style={styles.muted}>{profile.email || 'Email not set'}</Text>
          </View>
          <Image source={aiIcon} style={styles.aiIcon} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>User Info</Text>
        <Text style={styles.jobDescription}>These values are used by the WebView autofill engine.</Text>
        <View style={styles.profileGrid}>
          {profileFields.map((field) => (
            <ProfileInput
              key={field.key}
              config={field}
              value={profile[field.key]}
              onChange={(value) => onUpdateProfile(field.key, value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.jobCard}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.jobTitle}>{liveJob.title}</Text>
            <Text style={styles.muted}>{liveJob.company} · {liveJob.location}</Text>
            <Text style={styles.jobDescription}>Live Lever application page controlled from React Native via injected JavaScript.</Text>
          </View>
          <View style={styles.atsBadge}>
            <Text style={styles.atsBadgeText}>{liveJob.ats}</Text>
          </View>
        </View>
      </View>

      <Pressable style={styles.primaryButton} onPress={onStart}>
        <Text style={styles.primaryButtonText}>Start WebView Demo</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProfileInput({
  config,
  value,
  onChange,
  compact,
}: {
  config: ProfileFieldConfig;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.profileInputWrap, compact && styles.profileInputWrapCompact]}>
      <Text style={styles.profileLabel}>{config.label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={config.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={config.keyboardType || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.profileInput}
      />
    </View>
  );
}

function LiveApplyScreen({
  webViewKey,
  webViewUrl,
  status,
  diagnostic,
  stats,
  requiredDone,
  requiredTotal,
  reviewReady,
  fields,
  profile,
  fieldAnswers,
  missingRequirements,
  assistantVisible,
  assistantRequirements,
  headerVisible,
  webViewRef,
  onUpdateProfile,
  onUpdateFieldAnswer,
  onContinueAutofill,
  onBack,
  onScan,
  onAutofill,
  onReset,
  onFocusField,
  onMessage,
  onLoad,
  onError,
}: {
  webViewKey: number;
  webViewUrl: string;
  status: string;
  diagnostic: string;
  stats: typeof emptyStats;
  requiredDone: number;
  requiredTotal: number;
  reviewReady: boolean;
  fields: FormField[];
  profile: Profile;
  fieldAnswers: FieldAnswers;
  missingRequirements: MissingRequirement[];
  assistantVisible: boolean;
  assistantRequirements: MissingRequirement[];
  headerVisible: boolean;
  webViewRef: React.RefObject<WebView | null>;
  onUpdateProfile: (key: ProfileKey, value: string) => void;
  onUpdateFieldAnswer: (fieldId: string, value: string) => void;
  onContinueAutofill: () => void;
  onBack: () => void;
  onScan: () => void;
  onAutofill: () => void;
  onReset: () => void;
  onFocusField: (fieldId: string) => void;
  onMessage: (event: WebViewMessageEvent) => void;
  onLoad: (url?: string) => void;
  onError: (message: string) => void;
}) {
  const headerProgress = useSharedValue(1);

  useEffect(() => {
    headerProgress.value = withTiming(headerVisible ? 1 : 0, {
      duration: headerVisible ? 280 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [headerProgress, headerVisible]);

  const webWrapAnimatedStyle = useAnimatedStyle(() => ({
    top: HEADER_VISIBLE_SPACE * headerProgress.value,
  }));

  return (
    <View style={styles.apply}>
      <Animated.View style={[styles.webWrap, webWrapAnimatedStyle]}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: webViewUrl }}
          originWhitelist={['https://*']}
          injectedJavaScript={webViewBootstrapScript()}
          onMessage={onMessage}
          onLoadEnd={(event) => onLoad(event.nativeEvent.url)}
          onError={(event) => onError(`WebView error ${event.nativeEvent.code}: ${event.nativeEvent.description}`)}
          onHttpError={(event) => onError(`HTTP ${event.nativeEvent.statusCode}: ${event.nativeEvent.url}`)}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          style={styles.webView}
        />
      </Animated.View>

      <AutoHidingHeader
        visible={headerVisible}
        progress={headerProgress}
        status={status}
        stats={stats}
        reviewReady={reviewReady}
        requiredDone={requiredDone}
        requiredTotal={requiredTotal}
        onBack={onBack}
        onScan={onScan}
        onAutofill={onAutofill}
        onReset={onReset}
      />

      <AutofillAssistantSheet
        visible={assistantVisible}
        requirements={assistantRequirements}
        profile={profile}
        fieldAnswers={fieldAnswers}
        onUpdateProfile={onUpdateProfile}
        onUpdateFieldAnswer={onUpdateFieldAnswer}
        onContinue={onContinueAutofill}
      />
    </View>
  );
}

function AutoHidingHeader({
  visible,
  progress,
  status,
  stats,
  reviewReady,
  requiredDone,
  requiredTotal,
  onBack,
  onScan,
  onAutofill,
  onReset,
}: {
  visible: boolean;
  progress: SharedValue<number>;
  status: string;
  stats: typeof emptyStats;
  reviewReady: boolean;
  requiredDone: number;
  requiredTotal: number;
  onBack: () => void;
  onScan: () => void;
  onAutofill: () => void;
  onReset: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: -HEADER_VISIBLE_SPACE * (1 - progress.value),
      },
      {
        scale: 0.96 + progress.value * 0.04,
      },
    ],
  }));

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.floatingHeader, animatedStyle]}>
      <View style={styles.headerTopRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back to profile" style={styles.headerBackButton} onPress={onBack}>
          <Text style={styles.headerBackIcon}>‹</Text>
          <Text style={styles.headerBackText}>Back</Text>
        </Pressable>

        <View style={styles.headerBrandBlock}>
          <Image source={logo} style={styles.headerMiniLogo} />
          <View style={styles.headerCopy}>
            <Text style={styles.headerMiniTitle}>OptimHire</Text>
            <Text style={styles.headerMiniStatus} numberOfLines={1}>
              {reviewReady
                ? 'Ready for review'
                : requiredTotal > 0
                  ? `${requiredDone}/${requiredTotal} required · ${stats.filled} filled`
                  : status}
            </Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Run autofill" style={styles.headerPrimaryAction} onPress={onAutofill}>
          <Text style={styles.headerPrimaryTitle}>Run Autofill</Text>
        </Pressable>
      </View>

      <View style={styles.headerUtilityRow}>
        <HeaderUtilityButton title="Scan Page" detail="Find fields" onPress={onScan} />
        <HeaderUtilityButton title="Reset Form" detail="Clear page only" onPress={onReset} />
        <View style={styles.headerProgressPill}>
          <Text style={styles.headerProgressLabel}>{stats.detected} fields</Text>
          <Text style={styles.headerProgressValue}>{stats.manual} manual</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function HeaderUtilityButton({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} style={styles.headerUtilityButton} onPress={onPress}>
      <Text style={styles.headerUtilityTitle}>{title}</Text>
      <Text style={styles.headerUtilityDetail}>{detail}</Text>
    </Pressable>
  );
}

function AutofillAssistantSheet({
  visible,
  requirements,
  profile,
  fieldAnswers,
  onUpdateProfile,
  onUpdateFieldAnswer,
  onContinue,
}: {
  visible: boolean;
  requirements: MissingRequirement[];
  profile: Profile;
  fieldAnswers: FieldAnswers;
  onUpdateProfile: (key: ProfileKey, value: string) => void;
  onUpdateFieldAnswer: (fieldId: string, value: string) => void;
  onContinue: () => void;
}) {
  const progress = useSharedValue(0);
  const incomplete = getIncompleteRequirements(requirements, profile, fieldAnswers);
  const isReady = requirements.length > 0 && incomplete.length === 0;

  useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 20,
      stiffness: 180,
      mass: 0.9,
    });
  }, [progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: 340 * (1 - progress.value),
      },
    ],
  }));

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.assistantSheet, animatedStyle]}>
      <View style={styles.assistantHandle} />
      <View style={styles.assistantHeaderRow}>
        <View>
          <Text style={styles.assistantTitle}>Complete missing info</Text>
          <Text style={styles.assistantSubtitle}>
            {isReady
              ? 'All details are ready.'
              : `We need ${incomplete.length} ${incomplete.length === 1 ? 'detail' : 'details'} before autofill.`}
          </Text>
        </View>
        <Image source={aiIcon} style={styles.assistantIcon} />
      </View>

      <ScrollView style={styles.assistantForm} contentContainerStyle={styles.assistantFormContent}>
        {requirements.map((requirement) => {
          if (requirement.kind === 'profile') {
            const config = profileConfigForKey(requirement.profileKey);

            return (
              <ProfileInput
                key={requirement.id}
                config={{
                  key: requirement.profileKey,
                  label: requirement.label,
                  placeholder: requirement.placeholder,
                  keyboardType: requirement.keyboardType || config?.keyboardType,
                }}
                value={profile[requirement.profileKey]}
                onChange={(value) => onUpdateProfile(requirement.profileKey, value)}
              />
            );
          }

          return (
            <View key={requirement.id} style={styles.profileInputWrap}>
              <Text style={styles.profileLabel}>{requirement.label}</Text>
              <TextInput
                value={fieldAnswers[requirement.fieldId] || ''}
                onChangeText={(value) => onUpdateFieldAnswer(requirement.fieldId, value)}
                placeholder={requirement.placeholder}
                placeholderTextColor={colors.muted}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                style={[styles.profileInput, styles.assistantTextArea]}
              />
            </View>
          );
        })}
      </ScrollView>

      <Pressable
        style={[styles.assistantButton, !isReady && styles.assistantButtonDisabled]}
        onPress={onContinue}
      >
        <Text style={styles.assistantButtonText}>Continue Autofill</Text>
      </Pressable>
    </Animated.View>
  );
}

function FieldPill({ field, onFocus }: { field: FormField; onFocus?: (fieldId: string) => void }) {
  const statusStyle =
    field.status === 'success'
      ? styles.fieldPillSuccess
      : field.status === 'manual'
        ? styles.fieldPillManual
        : field.status === 'skipped'
          ? styles.fieldPillSkipped
          : styles.fieldPillPending;
  const detail = field.mappedValue || field.reason || field.type;
  const canFocus = Boolean(onFocus && (field.status === 'manual' || field.status === 'skipped'));
  const content = (
    <>
      <Text style={styles.fieldPillLabel} numberOfLines={1}>{field.label || field.id}</Text>
      <Text style={styles.fieldPillMeta} numberOfLines={1}>{field.status} · {detail}</Text>
    </>
  );

  if (canFocus) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Focus ${field.label || field.id}`} style={[styles.fieldPill, statusStyle]} onPress={() => onFocus?.(field.id)}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.fieldPill, statusStyle]}>
      {content}
    </View>
  );
}

function CommandButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable style={[styles.commandButton, primary && styles.commandButtonPrimary]} onPress={onPress}>
      <Text style={[styles.commandButtonText, primary && styles.commandButtonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function webViewBootstrapScript() {
  return `
    (function() {
      if (window.__optimhireBootstrapped) {
        true;
        return;
      }
      window.__optimhireBootstrapped = true;
      const send = (message) => {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        } catch (error) {}
      };
      const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const controls = () => Array.from(document.querySelectorAll('input, textarea, select'));
      const visibleControls = () => controls().filter((element) => element.type !== 'hidden' && element.type !== 'file' && visible(element));
      const fieldId = (element, index) => element.id || element.name || element.getAttribute('data-qa') || 'lever-field-' + index;
      const labelFor = (element) => {
        const container = element.closest('li, label, .application-question, .application-field, .custom-question, .field, .form-field');
        const explicitLabel = element.id ? document.querySelector('label[for="' + element.id.replace(/"/g, '') + '"]') : null;
        const label = explicitLabel || container?.querySelector('.application-label, label, legend, .label') || element.closest('label');
        return clean(label?.innerText || element.getAttribute('aria-label') || element.placeholder || element.name || element.id || element.type || element.tagName);
      };
      const requiredFor = (element) => {
        const container = element.closest('li, label, .application-question, .application-field, .custom-question, .field, .form-field');
        const label = labelFor(element);
        const requiredNode = container?.querySelector('.required, [aria-label*="required"], [class*="required"]');
        return Boolean(
          element.required ||
          element.getAttribute('aria-required') === 'true' ||
          requiredNode ||
          /\\*/.test(label) ||
          /required/i.test(container?.textContent || '')
        );
      };
      const infoFor = (element, index) => ({
        id: fieldId(element, index),
        label: labelFor(element),
        type: element.tagName.toLowerCase() === 'select' ? 'select' : element.tagName.toLowerCase() === 'textarea' ? 'textarea' : element.type || element.tagName.toLowerCase(),
        required: requiredFor(element),
        status: 'pending'
      });
      const scan = () => {
        const fields = visibleControls().map(infoFor);
        const fileInputs = controls().filter((element) => element.type === 'file');
        const hiddenInputs = controls().filter((element) => element.type === 'hidden');
        const applyButton = document.querySelector('a[href$="/apply"], a[href*="/apply"], .postings-btn[href*="/apply"]');
        const form = document.querySelector('#application-form, form');
        const submit = document.querySelector('#btn-submit, button[type="submit"], input[type="submit"]');
        const captcha = document.querySelector('.h-captcha, iframe[src*="hcaptcha"], script[src*="hcaptcha"]');
        send({
          type: 'PAGE_SCANNED',
          title: clean(document.querySelector('h1, h2, .posting-headline h2')?.textContent || document.title),
          url: window.location.href,
          applyButtonFound: Boolean(applyButton),
          formFound: Boolean(form),
          fieldCount: fields.length,
          hiddenCount: hiddenInputs.length,
          fileCount: fileInputs.length,
          submitFound: Boolean(submit),
          captchaFound: Boolean(captcha)
        });
        send({ type: 'FIELD_DETECTED', fields });
        fileInputs.forEach((element, index) => {
          const container = element.closest('li, label, .application-question');
          markManualField(element, 'Attach resume');
          send({
            type: 'MANUAL_REQUIRED',
            id: element.id || element.name || 'resume-file-' + index,
            label: labelFor(element) || 'Resume/CV',
            fieldType: 'file',
            required: requiredFor(element),
            reason: 'Manual attachment required'
          });
        });
      };
      let lastY = window.scrollY || document.documentElement.scrollTop || 0;
      let ticking = false;
      const reportScroll = () => {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const delta = y - lastY;
        const direction = Math.abs(delta) < 8 ? 'none' : delta > 0 ? 'down' : 'up';
        lastY = y;
        send({ type: 'SCROLL_STATE', scrollY: y, direction, isNearTop: y < 36 });
        ticking = false;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(reportScroll);
        }
      }, { passive: true });
      reportScroll();
      const resumePreflight = async () => {
        let shouldResume = false;
        try {
          shouldResume = sessionStorage.getItem('__optimhirePendingPreflight') === '1';
        } catch (error) {}
        if (!shouldResume) return;
        for (let attempt = 0; attempt < 24; attempt += 1) {
          if (document.querySelector('#application-form, form')) {
            try {
              sessionStorage.removeItem('__optimhirePendingPreflight');
            } catch (error) {}
            scan();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        scan();
      };
      resumePreflight();
      true;
    })();
  `;
}

function liveLeverAutomationScript(command: Command, profile: Profile, fieldAnswers: FieldAnswers = {}, focusFieldId?: string) {
  const payload = JSON.stringify({
    command,
    job: liveJob,
    profile,
    fieldAnswers,
    focusFieldId,
  });

  return `
    (function() {
      const payload = ${payload};
      const send = (message) => {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        } catch (error) {}
      };
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const controls = () => Array.from(document.querySelectorAll('input, textarea, select'));
      const visibleControls = () => controls().filter((element) => element.type !== 'hidden' && element.type !== 'file' && visible(element));
      const fieldId = (element, index) => element.id || element.name || element.getAttribute('data-qa') || 'lever-field-' + index;
      const labelFor = (element) => {
        const container = element.closest('li, label, .application-question, .application-field, .custom-question, .field, .form-field');
        const explicitLabel = element.id ? document.querySelector('label[for="' + element.id.replace(/"/g, '') + '"]') : null;
        const label = explicitLabel || container?.querySelector('.application-label, label, legend, .label') || element.closest('label');
        return clean(label?.innerText || element.getAttribute('aria-label') || element.placeholder || element.name || element.id || element.type || element.tagName);
      };
      const requiredFor = (element) => {
        const container = element.closest('li, label, .application-question, .application-field, .custom-question, .field, .form-field');
        const label = labelFor(element);
        const requiredNode = container?.querySelector('.required, [aria-label*="required"], [class*="required"]');
        return Boolean(
          element.required ||
          element.getAttribute('aria-required') === 'true' ||
          requiredNode ||
          /\\*/.test(label) ||
          /required/i.test(container?.textContent || '')
        );
      };
      const infoFor = (element, index) => ({
        id: fieldId(element, index),
        label: labelFor(element),
        type: element.tagName.toLowerCase() === 'select' ? 'select' : element.tagName.toLowerCase() === 'textarea' ? 'textarea' : element.type || element.tagName.toLowerCase(),
        required: requiredFor(element),
        status: 'pending'
      });
      const answerBank = [
        { test: /full\\s*name|name-input|^name$/i, value: payload.profile.name },
        { test: /email/i, value: payload.profile.email },
        { test: /phone|mobile/i, value: payload.profile.phone },
        { test: /location|city|address/i, value: payload.profile.location },
        { test: /company|current employer|organization|org-input/i, value: payload.profile.currentCompany },
        { test: /linkedin/i, value: payload.profile.linkedIn },
        { test: /github/i, value: payload.profile.github },
        { test: /portfolio|website|personal site/i, value: payload.profile.portfolio },
        { test: /authorized|work authorization|visa/i, value: payload.profile.workAuthorization },
        { test: /start date|available|availability/i, value: payload.profile.earliestStart },
        { test: /salary|compensation|expected pay/i, value: payload.profile.salaryExpectation },
        { test: /years|experience/i, value: payload.profile.yearsExperience },
        { test: /european time zone|cet|timezone/i, value: 'Yes, I can work CET +/-2 hours.' },
        { test: /gambling|gaming/i, value: '2 years of adjacent gaming/product experience; open to ramping quickly in regulated online gambling.' },
        { test: /why.*interested|cover letter|tell us/i, value: 'I am interested because the role combines React Native architecture, product automation, and user-focused mobile workflows.' }
      ];
      const scan = () => {
        const fields = visibleControls().map(infoFor);
        const fileInputs = controls().filter((element) => element.type === 'file');
        const hiddenInputs = controls().filter((element) => element.type === 'hidden');
        const applyButton = document.querySelector('a[href$="/apply"], a[href*="/apply"], .postings-btn[href*="/apply"]');
        const form = document.querySelector('#application-form, form');
        const submit = document.querySelector('#btn-submit, button[type="submit"], input[type="submit"]');
        const captcha = document.querySelector('.h-captcha, iframe[src*="hcaptcha"], script[src*="hcaptcha"]');
        const title = clean(document.querySelector('h1, h2, .posting-headline h2')?.textContent || document.title);
        send({
          type: 'PAGE_SCANNED',
          title,
          url: window.location.href,
          applyButtonFound: Boolean(applyButton),
          formFound: Boolean(form),
          fieldCount: fields.length,
          hiddenCount: hiddenInputs.length,
          fileCount: fileInputs.length,
          submitFound: Boolean(submit),
          captchaFound: Boolean(captcha)
        });
        send({ type: 'FIELD_DETECTED', fields });
        fileInputs.forEach((element, index) => {
          const container = element.closest('li, label, .application-question');
          send({
            type: 'MANUAL_REQUIRED',
            id: element.id || element.name || 'resume-file-' + index,
            label: labelFor(element) || 'Resume/CV',
            fieldType: 'file',
            required: requiredFor(element),
            reason: 'Manual attachment required'
          });
        });
      };
      const waitForFormAndScan = async () => {
        for (let attempt = 0; attempt < 24; attempt += 1) {
          if (document.querySelector('#application-form, form')) {
            try {
              sessionStorage.removeItem('__optimhirePendingPreflight');
            } catch (error) {}
            scan();
            return;
          }
          await sleep(250);
        }
        scan();
      };
      const openApply = async () => {
        try {
          sessionStorage.setItem('__optimhirePendingPreflight', '1');
        } catch (error) {}
        if (document.querySelector('#application-form')) {
          send({ type: 'APPLY_FORM_OPENED', url: window.location.href, formFound: true });
          await waitForFormAndScan();
          return;
        }
        const applyButton = document.querySelector('a[href$="/apply"], a[href*="/apply"], .postings-btn[href*="/apply"]');
        send({ type: 'APPLY_FORM_OPENED', url: applyButton?.href || payload.job.applyUrl, formFound: false });
        if (applyButton) {
          applyButton.click();
        } else {
          window.location.href = payload.job.applyUrl;
        }
        await waitForFormAndScan();
      };
      const fieldValue = (info) => {
        const haystack = (info.label + ' ' + info.id).toLowerCase();
        if (payload.fieldAnswers && payload.fieldAnswers[info.id]) return payload.fieldAnswers[info.id];
        const match = answerBank.find((answer) => answer.test.test(haystack));
        return match?.value || '';
      };
      const optionMatches = (option, value) => {
        const optionText = clean(option.text).toLowerCase();
        const optionValue = clean(option.value).toLowerCase();
        const normalized = clean(value).toLowerCase();
        return optionText === normalized || optionValue === normalized || optionText.includes(normalized) || normalized.includes(optionText);
      };
      const chooseRadioOrCheckbox = (element, info, value) => {
        const label = (labelFor(element) + ' ' + element.value + ' ' + info.label).toLowerCase();
        const wantsYes = /yes|true|authorized|eligible|agree|consent|privacy|terms|timezone/i.test(value + ' ' + info.label);
        const safeYes = /yes|true|authorized|eligible|agree|consent|privacy|terms|timezone/i.test(label);
        const safeNo = /no|false/i.test(label);
        if (wantsYes && safeYes) return true;
        if (!wantsYes && safeNo) return true;
        return false;
      };
      const dispatchInputChange = (element) => {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const dispatch = (element) => {
        dispatchInputChange(element);
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      };
      const fieldChromeFor = (element) => element.closest('.application-field') || element;
      const clearOptimHireMarks = () => {
        document.querySelectorAll('[data-optimhire-marked="true"]').forEach((element) => {
          element.style.outline = '';
          element.style.backgroundColor = '';
          element.style.borderColor = '';
        });
        document.querySelectorAll('[data-optimhire-note="true"]').forEach((element) => element.remove());
      };
      const markManualField = (element, reason) => {
        const chrome = fieldChromeFor(element);
        const target = visible(element) ? element : chrome;
        target.dataset.optimhireMarked = 'true';
        target.style.outline = '2px solid #D93A3A';
        target.style.borderColor = '#D93A3A';
      };
      const markFilledField = (element) => {
        const chrome = fieldChromeFor(element);
        [element, chrome].forEach((target) => {
          target.style.outline = '';
          target.style.backgroundColor = '';
          target.style.borderColor = '';
        });
      };
      const isLocationInput = (element) => (
        element.id === 'location-input' ||
        element.name === 'location' ||
        (element.classList && element.classList.contains('location-input')) ||
        element.getAttribute('data-qa') === 'location-input'
      );
      const prepareManualLocationField = (element, value) => {
        element.focus();
        if (value) {
          element.value = value;
          dispatchInputChange(element);
        }
        const selectedLocation = document.querySelector('#selected-location');
        if (selectedLocation) {
          selectedLocation.value = '';
        }
        markManualField(element, 'Choose from dropdown');
      };
      const fieldById = (targetId) => {
        const all = controls();
        return all.find((element, index) => fieldId(element, index) === targetId);
      };
      const focusField = () => {
        const element = fieldById(payload.focusFieldId);
        if (!element) return;
        const chrome = fieldChromeFor(element);
        chrome.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (element.type !== 'file') {
          element.focus();
        }
      };
      const autofill = async () => {
        if (!document.querySelector('#application-form')) {
          openApply();
          return;
        }
        const fieldElements = visibleControls();
        const fields = fieldElements.map(infoFor);
        const fileInputs = controls().filter((element) => element.type === 'file');
        let filled = 0;
        let skipped = 0;
        let manual = fileInputs.length;
        clearOptimHireMarks();
        send({ type: 'FIELD_DETECTED', fields });
        fileInputs.forEach((element, index) => {
          markManualField(element, 'Attach resume');
          send({
            type: 'MANUAL_REQUIRED',
            id: element.id || element.name || 'resume-file-' + index,
            label: labelFor(element) || 'Resume/CV',
            fieldType: 'file',
            required: requiredFor(element),
            reason: 'Manual attachment required'
          });
        });
        for (let index = 0; index < fieldElements.length; index += 1) {
          const element = fieldElements[index];
          const info = infoFor(element, index);
          const value = fieldValue(info);
          if (!value) {
            manual += 1;
            markManualField(element, 'No confident mapping');
            send({ type: 'MANUAL_REQUIRED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, reason: 'No confident mapping' });
            continue;
          }
          if (isLocationInput(element)) {
            prepareManualLocationField(element, value);
            manual += 1;
            send({ type: 'MANUAL_REQUIRED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, reason: 'Choose from dropdown' });
            continue;
          } else if (element.tagName.toLowerCase() === 'select') {
            const match = Array.from(element.options).find((option) => optionMatches(option, value));
            if (!match) {
              manual += 1;
              markManualField(element, 'No matching option');
              send({ type: 'MANUAL_REQUIRED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, reason: 'No matching option' });
              continue;
            }
            element.value = match.value;
          } else if (element.type === 'checkbox') {
            if (!chooseRadioOrCheckbox(element, info, value)) {
              manual += 1;
              markManualField(element, 'Unsafe checkbox');
              send({ type: 'MANUAL_REQUIRED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, reason: 'Unsafe checkbox' });
              continue;
            }
            element.checked = true;
          } else if (element.type === 'radio') {
            if (!chooseRadioOrCheckbox(element, info, value)) {
              manual += 1;
              markManualField(element, 'Unsafe radio option');
              send({ type: 'MANUAL_REQUIRED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, reason: 'Unsafe radio option' });
              continue;
            }
            element.checked = true;
          } else if (element.type === 'date') {
            element.value = /^\\d{4}-\\d{2}-\\d{2}$/.test(value) ? value : payload.profile.earliestStart;
          } else if (element.type === 'number') {
            const numericValue = value.match(/\\d+/)?.[0];
            if (!numericValue) {
              manual += 1;
              markManualField(element, 'No numeric mapping');
              send({ type: 'MANUAL_REQUIRED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, reason: 'No numeric mapping' });
              continue;
            }
            element.value = numericValue;
          } else {
            element.value = value;
          }
          dispatch(element);
          markFilledField(element);
          filled += 1;
          send({ type: 'FIELD_FILLED', id: info.id, label: info.label || info.id, fieldType: info.type, required: info.required, mappedValue: value });
          await sleep(140);
        }
        if (manual === 0) {
          document.querySelector('#btn-submit, button[type="submit"], input[type="submit"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        send({ type: 'READY_FOR_REVIEW', detected: fields.length + fileInputs.length, filled, skipped, manual });
      };
      const resetForm = () => {
        const form = document.querySelector('#application-form, form');
        if (form && typeof form.reset === 'function') {
          form.reset();
        }
        clearOptimHireMarks();
        const selectedLocation = document.querySelector('#selected-location');
        if (selectedLocation) {
          selectedLocation.value = '';
        }
        controls().forEach((element) => {
          if (!form) {
            if (element.type === 'checkbox' || element.type === 'radio') {
              element.checked = element.defaultChecked;
            } else if (element.tagName.toLowerCase() === 'select') {
              Array.from(element.options).forEach((option) => {
                option.selected = option.defaultSelected;
              });
            } else if (element.type !== 'hidden' && element.type !== 'file') {
              element.value = element.defaultValue || '';
            }
          }
          element.style.outline = '';
          element.style.backgroundColor = '';
          dispatch(element);
        });
        scan();
        send({ type: 'FORM_RESET', detected: visibleControls().length });
      };
      if (payload.command === 'scan') scan();
      if (payload.command === 'preflightAutofill') openApply();
      if (payload.command === 'autofill') autofill();
      if (payload.command === 'focusField') focusField();
      if (payload.command === 'resetForm') resetForm();
      true;
    })();
  `;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  heroLogo: {
    width: 82,
    height: 82,
    borderRadius: 20,
    marginBottom: 12,
  },
  wordmark: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 12,
  },
  heroTitle: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroCopy: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  capabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  capabilityChip: {
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: '#D4E8FF',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  capabilityText: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 11,
    fontWeight: '900',
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    padding: 16,
    paddingBottom: 36,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  kicker: {
    color: colors.primary,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 22,
    fontWeight: '900',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  muted: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.card,
    fontFamily: fonts.black,
    fontSize: 15,
    fontWeight: '900',
  },
  jobCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
    marginBottom: 12,
  },
  aiIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  profileGrid: {
    gap: 10,
    marginTop: 12,
  },
  profileInputWrap: {
    gap: 5,
  },
  profileInputWrapCompact: {
    width: 190,
    marginRight: 8,
  },
  profileLabel: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 11,
    fontWeight: '900',
  },
  profileInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  jobTitle: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  jobDescription: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  atsBadge: {
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  atsBadgeText: {
    color: colors.primary,
    fontFamily: fonts.black,
    fontSize: 11,
    fontWeight: '900',
  },
  apply: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
  },
  floatingHeader: {
    position: 'absolute',
    top: HEADER_TOP_OFFSET,
    left: 10,
    right: 10,
    minHeight: HEADER_MIN_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 8,
    gap: 8,
    shadowColor: '#111827',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBackButton: {
    height: 38,
    paddingLeft: 0,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headerBackIcon: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
    marginTop: -2,
  },
  headerBackText: {
    color: colors.navy,
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  headerBrandBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerMiniLogo: {
    width: 26,
    height: 26,
    borderRadius: 7,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerMiniTitle: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 15,
    fontWeight: '900',
  },
  headerMiniStatus: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 14,
  },
  headerPrimaryAction: {
    height: 38,
    minWidth: 112,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerPrimaryTitle: {
    color: colors.card,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
  },
  headerUtilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerUtilityButton: {
    flex: 1,
    minHeight: 39,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F9FBFF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  headerUtilityTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  headerUtilityDetail: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
  },
  headerProgressPill: {
    minWidth: 76,
    minHeight: 39,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: '#E7EAEE',
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  headerProgressLabel: {
    color: colors.navy,
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  headerProgressValue: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
  },
  assistantSheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    maxHeight: '58%',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#111827',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
    zIndex: 30,
  },
  assistantHandle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#C9D2DD',
    alignSelf: 'center',
    marginBottom: 10,
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  assistantTitle: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 18,
    fontWeight: '900',
  },
  assistantSubtitle: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  assistantIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  assistantForm: {
    maxHeight: 230,
  },
  assistantFormContent: {
    gap: 10,
    paddingBottom: 4,
  },
  assistantTextArea: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  assistantButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    marginTop: 12,
  },
  assistantButtonDisabled: {
    backgroundColor: '#9ABEEB',
  },
  assistantButtonText: {
    color: colors.card,
    fontFamily: fonts.black,
    fontSize: 14,
    fontWeight: '900',
  },
  bottomDock: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 11,
    shadowColor: '#111827',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallLogo: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  topBrand: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 18,
    fontWeight: '900',
  },
  modePill: {
    backgroundColor: colors.soft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  modeText: {
    color: colors.primary,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
  },
  statusTitle: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 8,
  },
  diagnostic: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  compactStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  successText: {
    color: colors.success,
  },
  warningText: {
    color: colors.warning,
  },
  requiredText: {
    color: colors.navy,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
  },
  compactStats: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  reviewBox: {
    backgroundColor: colors.successBg,
    borderRadius: 8,
    padding: 7,
    marginTop: 7,
  },
  reviewText: {
    color: colors.success,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
  },
  missingBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: '#F4D59B',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  missingTitle: {
    color: colors.warning,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
  },
  missingCopy: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 7,
  },
  missingRail: {
    maxHeight: 78,
  },
  fieldRail: {
    marginTop: 8,
  },
  fieldPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginRight: 7,
    width: 148,
  },
  fieldPillPending: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  fieldPillSuccess: {
    backgroundColor: colors.successBg,
    borderColor: '#A7E5C8',
  },
  fieldPillManual: {
    backgroundColor: colors.errorBg,
    borderColor: '#F1B5B5',
  },
  fieldPillSkipped: {
    backgroundColor: colors.errorBg,
    borderColor: '#F1B5B5',
  },
  fieldPillLabel: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 11,
    fontWeight: '900',
  },
  fieldPillMeta: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 2,
  },
  commandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  commandButton: {
    flexGrow: 1,
    flexBasis: '28%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 9,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  commandButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  commandButtonText: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 12,
    fontWeight: '900',
  },
  commandButtonTextPrimary: {
    color: colors.card,
  },
  webWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.card,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
