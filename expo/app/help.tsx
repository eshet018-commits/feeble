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

const FAQ_ITEMS = [
  {
    question: 'What is Feeble?',
    answer:
      'Feeble is a group event management app. You can create or join groups, organize events with your group members, set reminders, and manage recurring events — all in one place.',
  },
  {
    question: 'How do I create a group?',
    answer:
      'Tap the blue "+" button on the home screen and select "Create Group." Give your group a name and optional description. You\'ll automatically become the group admin and a unique invite code will be generated for others to join.',
  },
  {
    question: 'How do I join a group?',
    answer:
      'Tap the person-with-plus icon on the home screen, then enter the invite code shared by the group admin. If the code is valid, you\'ll be added to the group instantly.',
  },
  {
    question: 'How do I invite others to my group?',
    answer:
      'Open your group, tap the invite button (usually at the top of the group screen), and share the invite code with your friends via any messaging app. Anyone with the code can join your group.',
  },
  {
    question: 'How do I create an event?',
    answer:
      'Inside a group, tap the "+" button to create a new event. You can set a title, description, start and end time, location, category, reminders, and even make it repeat daily, weekly, or monthly.',
  },
  {
    question: 'How do reminders work?',
    answer:
      'When creating or editing an event, you can add one or more reminder times (e.g. 10 minutes before, 1 hour before). The app will send you a push notification at each reminder time so you never miss an event.',
  },
  {
    question: 'What are recurring events?',
    answer:
      'You can set events to repeat daily, weekly, or monthly. Optionally set an end date so the event stops repeating after a certain date. The recurring instances show up automatically in your group calendar.',
  },
  {
    question: 'How do I change my password or email?',
    answer:
      'Go to your Profile (the person icon in the top-right of the home screen). Scroll down to find "Change Password" and "Change Email" sections. You\'ll need to enter your current password to confirm the change.',
  },
  {
    question: 'What do admin and viewer roles mean?',
    answer:
      'Admins can create events, edit group settings, invite members, promote/demote members, and delete the group. Viewers can see events and members but cannot make changes. Only the original group creator can demote other admins.',
  },
  {
    question: 'How do I leave a group?',
    answer:
      'Open the group and look for the settings or leave option. Note: if you\'re the group admin, you cannot leave — you\'ll need to delete the group or transfer admin rights first.',
  },
  {
    question: 'How do I delete a group?',
    answer:
      'Only the group admin can delete a group. Open the group, go to settings, and select "Delete Group." This will remove the group and all its events permanently — this action cannot be undone.',
  },
  {
    question: 'What happens when I sign out?',
    answer:
      'When you sign out, you\'ll be taken back to the sign-in screen. If you had "Remember Me" checked when signing in, you\'ll stay signed in even after closing the app. If unchecked, signing out or closing the app will require you to sign in again.',
  },
];

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
          <Text style={styles.title}>Help & Support</Text>
          <Text style={styles.subtitle}>
            Find answers to common questions or reach out to us directly
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQ_ITEMS.map((item, index) => (
              <FAQItem key={index} question={item.question} answer={item.answer} />
            ))}
          </View>
        </View>

        <View style={styles.contactSection}>
          <View style={styles.contactCard}>
            <View style={styles.contactIconContainer}>
              <Mail size={28} color="#007AFF" />
            </View>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactDescription}>
              Send us an email and we'll get back to you as soon as possible. We're here to help!
            </Text>
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
