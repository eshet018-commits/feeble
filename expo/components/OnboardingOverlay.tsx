import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useOnboarding } from '@/contexts/OnboardingContext';

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={stepStyles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            stepStyles.dot,
            i === current ? stepStyles.dotActive : stepStyles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#007AFF',
    width: 24,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: '#C7C7CC',
  },
});

function HighlightRing({
  x,
  y,
  width,
  height,
  isCircle,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  isCircle: boolean;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const borderRadius = isCircle ? Math.max(width, height) / 2 + 8 : 16;
  const extraPadding = 8;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        highlightStyles.ring,
        {
          left: x - extraPadding,
          top: y - extraPadding,
          width: width + extraPadding * 2,
          height: height + extraPadding * 2,
          borderRadius,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    />
  );
}

const highlightStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default function OnboardingOverlay() {
  const {
    isActive,
    isChecking,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    skipOnboarding,
    isFirstStep,
    isLastStep,
    measureTarget,
  } = useOnboarding();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [measuredRect, setMeasuredRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const measureRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isActive) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isActive, currentStep, fadeAnim]);

  // Measure the target button's actual screen position when the step changes
  useEffect(() => {
    if (!isActive) return;
    const step = currentStepData;
    if (!step?.targetRect) {
      setMeasuredRect(null);
      return;
    }

    setMeasuredRect(null);

    // Small delay to ensure native layout is settled
    measureRef.current = setTimeout(async () => {
      const rect = await measureTarget(step.key);
      if (rect) {
        setMeasuredRect(rect);
      }
    }, 50);

    return () => {
      if (measureRef.current !== null) {
        clearTimeout(measureRef.current);
        measureRef.current = null;
      }
    };
  }, [isActive, currentStep, currentStepData, measureTarget]);

  if (!isActive || isChecking) return null;

  const step = currentStepData;
  const hasTarget = step.targetRect !== null;

  let highlightX = 0;
  let highlightY = 0;
  let highlightW = 0;
  let highlightH = 0;
  let isCircle = false;

  if (hasTarget) {
    isCircle = step.targetRect?.isCircle ?? false;
    if (measuredRect) {
      // Use actual measured screen coordinates
      highlightX = measuredRect.x;
      highlightY = measuredRect.y;
      highlightW = measuredRect.width;
      highlightH = measuredRect.height;
    } else {
      // Fallback to hardcoded fractions while measurement is pending
      const tr = step.targetRect!;
      highlightX = tr.x * screenW;
      highlightY = tr.y * screenH;
      highlightW = tr.width;
      highlightH = tr.height;
    }
  }

  // Position the card: if target is in bottom half, place card above; otherwise below
  const targetCenterY = hasTarget ? highlightY + highlightH / 2 : screenH / 2;
  const isTargetBottom = targetCenterY > screenH * 0.55;
  const cardTop = hasTarget
    ? isTargetBottom
      ? highlightY - 220
      : highlightY + highlightH + 24
    : screenH * 0.35;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Dark backdrop */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop} />
        {/* Lightened area around target */}
        {hasTarget && (
          <View
            style={[
              styles.lightArea,
              {
                left: highlightX - 12,
                top: highlightY - 12,
                width: highlightW + 24,
                height: highlightH + 24,
                borderRadius: isCircle
                  ? Math.max(highlightW, highlightH) / 2 + 12
                  : 20,
              },
            ]}
          />
        )}
      </View>

      {/* Pulsing highlight ring */}
      {hasTarget && (
        <HighlightRing
          x={highlightX}
          y={highlightY}
          width={highlightW}
          height={highlightH}
          isCircle={isCircle}
        />
      )}

      {/* Card */}
      <View
        style={[
          styles.card,
          {
            top: Math.max(60, Math.min(cardTop, screenH - 300)),
            alignSelf: hasTarget
              ? highlightX < screenW * 0.5
                ? 'flex-start'
                : 'flex-end'
              : 'center',
          },
          // Center-aligned cards for non-target steps
          !hasTarget && { left: 24, right: 24, alignSelf: 'center' },
        ]}
      >
        <View style={styles.cardContent}>
          <Text style={styles.stepCount}>
            {currentStep + 1} of {totalSteps}
          </Text>
          <Text style={styles.cardTitle}>{step.title}</Text>
          <Text style={styles.cardDescription}>{step.description}</Text>

          <StepIndicator current={currentStep} total={totalSteps} />
        </View>

        <View style={styles.cardActions}>
          {!isFirstStep ? (
            <TouchableOpacity
              onPress={skipOnboarding}
              style={styles.skipButton}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipButton} />
          )}
          <TouchableOpacity
            onPress={nextStep}
            style={styles.nextButton}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>
              {isLastStep ? 'Get Started' : 'Next'}
            </Text>
            {!isLastStep && (
              <ChevronRight size={20} color="#FFF" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Close button (top-right) */}
      <TouchableOpacity
        onPress={skipOnboarding}
        style={styles.closeButton}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={24} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  lightArea: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  card: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    maxWidth: 400,
  },
  cardContent: {
    padding: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  stepCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  cardDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
