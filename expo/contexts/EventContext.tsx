import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Event, Category, ExpandedEvent, Poll, PollOption } from '@/types/event';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { scheduleEventReminders, cancelEventReminders } from '@/utils/notifications';
import { firebaseClient } from '@/lib/firebase-client';
import { useGroups } from './GroupContext';
import { useNotifications } from './NotificationContext';
import { useUser } from './UserContext';

const CATEGORIES_STORAGE_KEY = 'categories';

export const [EventProvider, useEvents] = createContextHook(() => {
  const { groups } = useGroups();
  const { userId } = useUser();
  const { showNotification } = useNotifications();
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const knownEventIds = useRef<Set<string>>(new Set());
  const groupNameById = useRef<Record<string, string>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    groups.forEach((g) => { map[g.id] = g.name; });
    groupNameById.current = map;
  }, [groups]);

  useEffect(() => {
    const groupIds = groups.map(g => g.id);
    if (groupIds.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = firebaseClient.subscribeToUserEvents(groupIds, (fetchedEvents) => {
      console.log('Events updated from Firebase:', fetchedEvents.length);
      // Fire in-app banners for events we haven't seen before.
      if (userId) {
        const now = Date.now();
        for (const ev of fetchedEvents) {
          if (knownEventIds.current.has(ev.id)) continue;
          knownEventIds.current.add(ev.id);
          if (knownEventIds.current.size > 500) {
            knownEventIds.current = new Set(Array.from(knownEventIds.current).slice(-300));
          }
          // Only notify for events created in the last 30 seconds —
          // older ones are history from before this session.
          const createdMs = new Date(ev.createdAt).getTime();
          if (isNaN(createdMs) || now - createdMs > 30_000) continue;
          showNotification({
            kind: 'event',
            title: `${groupNameById.current[ev.groupId] || 'Group'} · New Event`,
            body: ev.title,
            data: { eventId: ev.id, groupId: ev.groupId },
          });
        }
      }
      setEvents(fetchedEvents);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [groups, userId, showNotification]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (categoriesData) {
        setCategories(JSON.parse(categoriesData));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setIsLoading(false);
    }
  };

  const addEvent = useCallback(async (event: Event) => {
    try {
      console.log('Creating event with data:', {
        groupId: event.groupId,
        title: event.title,
      });
      
      const result = await firebaseClient.createEvent({
        groupId: event.groupId || '',
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay,
        categoryId: event.categoryId,
        repeatFrequency: event.repeatFrequency,
        repeatEndDate: event.repeatEndDate,
        reminders: event.reminders,
        location: event.location,
      });

      console.log('Event created successfully:', result.id);

      // Schedule local reminder notifications so the user is alerted before the event.
      try {
        await scheduleEventReminders(event);
      } catch (notifError) {
        console.warn('Failed to schedule event reminders:', notifError);
      }

      return event;
    } catch (error: any) {
      console.error('Failed to create event:', error);
      throw new Error(`Failed to create event: ${error?.message || 'Unknown error'}`);
    }
  }, []);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<Event>) => {
    try {
      await cancelEventReminders(eventId);
      const updatedEvent = await firebaseClient.updateEvent(eventId, updates);
      if (updatedEvent) {
        await scheduleEventReminders(updatedEvent);
      }
    } catch (error) {
      console.error('Failed to update event:', error);
      throw error;
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      await cancelEventReminders(eventId);
      await firebaseClient.deleteEvent(eventId);
    } catch (error) {
      console.error('Failed to delete event:', error);
      throw error;
    }
  }, []);

  const getEventsByGroupId = useCallback((groupId: string) => {
    return events.filter(e => e.groupId === groupId);
  }, [events]);

  const expandRecurringEvents = useCallback((startDate: Date, endDate: Date, groupId?: string): ExpandedEvent[] => {
    const expanded: ExpandedEvent[] = [];
    const filteredEvents = groupId ? events.filter(e => e.groupId === groupId) : events;

    filteredEvents.forEach(event => {
      const eventStart = new Date(event.startDate);

      if (event.repeatFrequency === 'none') {
        if (eventStart >= startDate && eventStart <= endDate) {
          expanded.push({ ...event, instanceDate: event.startDate, isRecurring: false });
        }
        return;
      }

      const repeatEnd = event.repeatEndDate ? new Date(event.repeatEndDate) : endDate;
      let currentDate = new Date(eventStart);
      const maxDate = repeatEnd < endDate ? repeatEnd : endDate;

      while (currentDate <= maxDate) {
        if (currentDate >= startDate) {
          expanded.push({
            ...event,
            instanceDate: currentDate.toISOString(),
            isRecurring: true,
          });
        }

        switch (event.repeatFrequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }
      }
    });

    return expanded.sort((a, b) => 
      new Date(a.instanceDate).getTime() - new Date(b.instanceDate).getTime()
    );
  }, [events]);

  const getCategoryById = useCallback((id: string) => {
    return categories.find(c => c.id === id);
  }, [categories]);

  const addCategory = useCallback(async (category: Category) => {
    try {
      const newCategories = [...categories, category];
      setCategories(newCategories);
      await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(newCategories));
      return category;
    } catch (error) {
      console.error('Failed to add category:', error);
      throw error;
    }
  }, [categories]);

  const [polls, setPolls] = useState<Record<string, Poll>>({});

  const subscribeToPoll = useCallback((eventId: string) => {
    return firebaseClient.subscribeToPoll(eventId, (poll) => {
      setPolls(prev => {
        if (poll) {
          return { ...prev, [eventId]: poll };
        }
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    });
  }, []);

  const getPoll = useCallback((eventId: string): Poll | null => {
    return polls[eventId] || null;
  }, [polls]);

  const createPoll = useCallback(async (eventId: string, question: string, options: PollOption[]) => {
    return firebaseClient.createPoll(eventId, question, options);
  }, []);

  const updatePoll = useCallback(async (eventId: string, updates: { question?: string; options?: PollOption[] }) => {
    return firebaseClient.updatePoll(eventId, updates);
  }, []);

  const removePoll = useCallback(async (eventId: string) => {
    return firebaseClient.removePoll(eventId);
  }, []);

  const voteOnPoll = useCallback(async (eventId: string, userId: string, optionId: string) => {
    return firebaseClient.voteOnPoll(eventId, userId, optionId);
  }, []);

  return {
    events,
    categories,
    isLoading,
    polls,
    addEvent,
    updateEvent,
    deleteEvent,
    expandRecurringEvents,
    getCategoryById,
    getEventsByGroupId,
    addCategory,
    subscribeToPoll,
    getPoll,
    createPoll,
    updatePoll,
    removePoll,
    voteOnPoll,
  };
});

export function useUpcomingEvents(limit: number = 10) {
  const { expandRecurringEvents } = useEvents();
  
  return useMemo(() => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    
    const expanded = expandRecurringEvents(now, futureDate);
    return expanded.slice(0, limit);
  }, [expandRecurringEvents, limit]);
}
