import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useUser } from './UserContext';

export interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  /** Target coordinates as a fraction of screen width/height, or null for centered */
  targetRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Radius for circular highlight instead of rect */
    isCircle?: boolean;
  } | null;
}

const TOTAL_STEPS = 5;

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    key: 'welcome',
    title: 'Welcome to Feeble',
    description:
      'Organize events, manage groups, and keep everyone in sync. Let\u2019s take a quick tour.',
    targetRect: null,
  },
  {
    key: 'create-group',
    title: 'Create a Group',
    description:
      'Tap the + button to create your first group. Groups are where you\u2019ll schedule events and invite members.',
    targetRect: { x: 0.82, y: 0.88, width: 60, height: 60, isCircle: true },
  },
  {
    key: 'join-group',
    title: 'Join a Group',
    description:
      'Already been invited? Tap here, enter the group code, and you\u2019re in. You\u2019ll see all their events instantly.',
    targetRect: { x: 0.82, y: 0.8, width: 56, height: 56, isCircle: true },
  },
  {
    key: 'profile',
    title: 'Your Profile',
    description:
      'Tap your profile icon to update your name, change your password or email, and sign out when needed.',
    targetRect: { x: 0.85, y: 0.06, width: 40, height: 40, isCircle: true },
  },
  {
    key: 'done',
    title: 'You\u2019re All Set',
    description:
      'Create your first group, invite members, and start scheduling events. Have fun!',
    targetRect: null,
  },
];

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const { userId } = useUser();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasChecked, setHasChecked] = useState(false);
  const viewsRef = useRef<Map<string, View>>(new Map());

  const registerView = useCallback((key: string) => {
    return (ref: View | null) => {
      if (ref) {
        viewsRef.current.set(key, ref);
      } else {
        viewsRef.current.delete(key);
      }
    };
  }, []);

  const measureTarget = useCallback(
    (
      key: string,
    ): Promise<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null> => {
      return new Promise((resolve) => {
        const view = viewsRef.current.get(key);
        if (!view) {
          resolve(null);
          return;
        }
        view.measureInWindow((x, y, width, height) => {
          if (width === 0 && height === 0) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      });
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      setIsActive(false);
      setHasChecked(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const pendingKey = `onboarding_pending_${userId}`;
        const completedKey = `onboarding_completed_${userId}`;
        const [pendingRaw, completedRaw] = await Promise.all([
          AsyncStorage.getItem(pendingKey),
          AsyncStorage.getItem(completedKey),
        ]);

        if (cancelled) return;

        if (completedRaw === 'true') {
          setIsActive(false);
        } else if (pendingRaw === 'true') {
          setIsActive(true);
          setCurrentStep(0);
        }
      } catch {
        // Ignore storage errors
      } finally {
        if (!cancelled) setHasChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const completeOnboarding = useCallback(async () => {
    if (!userId) return;
    setIsActive(false);
    try {
      await Promise.all([
        AsyncStorage.setItem(`onboarding_completed_${userId}`, 'true'),
        AsyncStorage.removeItem(`onboarding_pending_${userId}`),
      ]);
    } catch {
      // Ignore storage errors
    }
  }, [userId]);

  const skipOnboarding = useCallback(async () => {
    if (!userId) return;
    setIsActive(false);
    try {
      await Promise.all([
        AsyncStorage.setItem(`onboarding_completed_${userId}`, 'true'),
        AsyncStorage.removeItem(`onboarding_pending_${userId}`),
      ]);
    } catch {
      // Ignore storage errors
    }
  }, [userId]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= TOTAL_STEPS - 1) {
        completeOnboarding();
        return prev;
      }
      return prev + 1;
    });
  }, [completeOnboarding]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const startOnboarding = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return {
    isActive,
    isChecking: !hasChecked,
    currentStep,
    totalSteps: TOTAL_STEPS,
    steps: ONBOARDING_STEPS,
    currentStepData: ONBOARDING_STEPS[currentStep] ?? ONBOARDING_STEPS[0],
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    startOnboarding,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === TOTAL_STEPS - 1,
    registerView,
    measureTarget,
  };
});
