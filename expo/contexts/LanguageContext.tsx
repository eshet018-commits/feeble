import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LanguageCode,
  TranslationKey,
  TRANSLATIONS,
  LANGUAGES,
} from '@/constants/translations';

const STORAGE_KEY = 'app_language';

/**
 * Provides the selected app language and a `t()` translation function.
 * The choice is persisted so it sticks across app launches.
 */
export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [isLanguageLoaded, setIsLanguageLoaded] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && TRANSLATIONS[stored as LanguageCode]) {
          setLanguageState(stored as LanguageCode);
        }
      })
      .catch(() => {})
      .finally(() => setIsLanguageLoaded(true));
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    setLanguageState(code);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, code);
    } catch (error) {
      console.warn('[Language] Failed to persist language:', error);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key];
    },
    [language],
  );

  return useMemo(
    () => ({ language, setLanguage, t, isLanguageLoaded, languages: LANGUAGES }),
    [language, setLanguage, t, isLanguageLoaded],
  );
});
