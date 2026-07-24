import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, HelpCircle, Mail, ExternalLink } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { HELP_CONTENT } from '@/constants/help-translations';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.6}
      >
        <Text style={styles.faqQuestionText}>{question}</Text>
        {isOpen ? (
          <ChevronUp size={20} color="#8E8E93" />
        ) : (
          <ChevronDown size={20} color="#8E8E93" />
        )}
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.faqAnswerContainer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function HelpScreen() {
  const { language } = useLanguage();
  const content = HELP_CONTENT[language] ?? HELP_CONTENT.en;

  const handleEmail = () => {
    Linking.openURL('mailto:feebleapp@gmail.com');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <HelpCircle size={40} color="#007AFF" strokeWidth={2} />
          </View>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{content.faqTitle}</Text>
          <View style={styles.faqList}>
            {content.faqs.map((item, index) => (
              <FAQItem key={`${language}-${index}`} question={item.question} answer={item.answer} />
            ))}
          </View>
        </View>

        <View style={styles.contactSection}>
          <View style={styles.contactCard}>
            <View style={styles.contactIconContainer}>
              <Mail size={28} color="#007AFF" />
            </View>
            <Text style={styles.contactTitle}>{content.contactTitle}</Text>
            <Text style={styles.contactDescription}>{content.contactDescription}</Text>
            <TouchableOpacity
              style={styles.emailButton}
              onPress={handleEmail}
              activeOpacity={0.7}
            >
              <Text style={styles.emailButtonText}>feebleapp@gmail.com</Text>
              <ExternalLink size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>Feeble — Made with Rork</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8E8E93',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  faqList: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    lineHeight: 22,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqAnswerText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 23,
  },
  contactSection: {
    marginBottom: 32,
  },
  contactCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  contactIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 8,
  },
  contactDescription: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F0FE',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emailButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: '#C7C7CC',
  },
});
