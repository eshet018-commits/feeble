import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Event } from '@/types/event';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleEventReminders(event: Event): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('Notifications not fully supported on web');
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log('Notification permissions not granted');
    return;
  }

  for (const reminder of event.reminders) {
    if (!reminder.enabled) continue;

    const eventDate = new Date(event.startDate);
    const reminderDate = new Date(eventDate.getTime() - reminder.minutes * 60000);

    if (reminderDate > new Date()) {
      try {
        const trigger: Notifications.DateTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        };
        await Notifications.scheduleNotificationAsync({
          content: {
            title: event.title,
            body: reminder.minutes === 0 
              ? 'Event is starting now'
              : `Event starts in ${formatReminderTime(reminder.minutes)}`,
            data: { eventId: event.id },
          },
          trigger,
        });
        console.log(`Scheduled reminder for ${event.title} at ${reminderDate}`);
      } catch (error) {
        console.error('Failed to schedule notification:', error);
      }
    }
  }
}

export async function cancelEventReminders(eventId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const eventNotifications = scheduledNotifications.filter(
      (notification) => notification.content.data?.eventId === eventId
    );

    for (const notification of eventNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    console.log(`Cancelled ${eventNotifications.length} reminders for event ${eventId}`);
  } catch (error) {
    console.error('Failed to cancel notifications:', error);
  }
}

function formatReminderTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}
