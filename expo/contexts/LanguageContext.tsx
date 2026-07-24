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

/** BCP-47 locale for date/time formatting per language */
export const LOCALES: Record<LanguageCode, string> = {
  en: 'en-US',
  am: 'am-ET',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  zh: 'zh-CN',
  hi: 'hi-IN',
};

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
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let value = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key];
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.split(`{${k}}`).join(String(v));
        });
      }
      return value;
    },
    [language],
  );

  const locale = LOCALES[language];

  return useMemo(
    () => ({ language, locale, setLanguage, t, isLanguageLoaded, languages: LANGUAGES }),
    [language, locale, setLanguage, t, isLanguageLoaded],
  );
});
