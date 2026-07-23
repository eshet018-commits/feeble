import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Announcement, AnnouncementDuration, AnnouncementPollInput } from '@/types/event';
import { firebaseClient } from '@/lib/firebase-client';
import { useUser } from './UserContext';
import { useGroups } from './GroupContext';
import {
  notifyAnnouncement,
  isAnnouncementSeen,
  markAnnouncementSeen,
  isNotifSeenSync,
  markNotifSeen,
} from '@/utils/notifications';
import { useNotifications } from './NotificationContext';

/**
 * Shared announcement state. Subscribes to announcements for the active group
 * so the group page and the announcements screen stay in sync.
 */
export const [AnnouncementProvider, useAnnouncements] = createContextHook(() => {
  const { userId } = useUser();
  const { groups } = useGroups();
  const { showNotification } = useNotifications();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const knownAnnouncementIds = useRef<Set<string>>(new Set());
  const groupIdsKey = groups.map((g) => g.id).join(',');
  const groupNameById = useRef<Record<string, string>>({});

  // Track the active group so both screens share one subscription.
  const setActiveGroup = useCallback((groupId: string | null) => {
    setActiveGroupId(groupId);
  }, []);

  // Keep a lookup of group names for notification titles.
  useEffect(() => {
    const map: Record<string, string> = {};
    groups.forEach((g) => { map[g.id] = g.name; });
    groupNameById.current = map;
  }, [groupIdsKey]);

  // ---------------------------------------------------------------------------
  // Background notification listener — subscribes to announcements across
  // every group the user is a member of and fires a local notification for
  // any new announcement they haven't seen yet.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!userId || !groupIdsKey) return;
    const groupIds = groupIdsKey.split(',').filter(Boolean);
    if (groupIds.length === 0) return;

    const unsub = firebaseClient.subscribeToAllAnnouncements(groupIds, async (list) => {
      const now = Date.now();
      for (const ann of list) {
        if (knownAnnouncementIds.current.has(ann.id)) continue;
        if (isNotifSeenSync(ann.id)) {
          // Already shown in a previous session — track it so we don't re-check.
          knownAnnouncementIds.current.add(ann.id);
          continue;
        }
        knownAnnouncementIds.current.add(ann.id);
        markNotifSeen(ann.id);
        if (knownAnnouncementIds.current.size > 500) {
          knownAnnouncementIds.current = new Set(
            Array.from(knownAnnouncementIds.current).slice(-300),
          );
        }
        // Skip announcements created by the current user.
        if (ann.createdBy === userId) continue;
        // Only notify for announcements created in the last 30 seconds —
        // older ones are history from before this session and shouldn't
        // flood the user with banners on app launch or subscription setup.
        const createdMs = new Date(ann.createdAt).getTime();
        if (isNaN(createdMs) || now - createdMs > 30_000) continue;

        // Instant in-app banner (works on all platforms, including web).
        // Fires for everyone — admins and viewers alike.
        showNotification({
          kind: 'announcement',
          title: `${groupNameById.current[ann.groupId] || 'Group'}`,
          body: `New announcement: ${ann.title}`,
          data: {
            announcementId: ann.id,
            groupId: ann.groupId,
            recipientUserId: userId,
          },
        });
        // Also fire a native system notification where supported.
        notifyAnnouncement({
          recipientUserId: userId,
          announcementId: ann.id,
          groupId: ann.groupId,
          groupName: groupNameById.current[ann.groupId] || 'Group',
          title: ann.title,
        }).catch(() => {});
      }
    });

    return () => unsub();
  }, [userId, groupIdsKey, showNotification]);

  useEffect(() => {
    if (!activeGroupId) {
      setAnnouncements([]);
      return;
    }
    const unsub = firebaseClient.subscribeToAnnouncements(activeGroupId, (list) => {
      setAnnouncements(list);
      // Mark visible announcements as seen for the native notification
      // handler, but do NOT add to knownAnnouncementIds — that set is
      // managed exclusively by the background listener so it can correctly
      // detect new announcements and notify everyone (admins included).
      if (userId) {
        list.forEach((a) => {
          markAnnouncementSeen(userId, a.id).catch(() => {});
        });
      }
    });
    return () => unsub();
  }, [activeGroupId, userId]);

  const createAnnouncement = useCallback(
    async (data: {
      groupId: string;
      title: string;
      body: string;
      createdBy: string;
      createdByName: string;
      durationHours: AnnouncementDuration;
      poll?: AnnouncementPollInput;
    }) => {
      setIsCreating(true);
      try {
        const announcement = await firebaseClient.createAnnouncement(data);

        // Remote push notifications are sent exclusively by the backend push
        // service (Firebase listener). Sending from the client here as well
        // caused every recipient to get the notification twice.
        return announcement;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  const updateAnnouncement = useCallback(
    async (id: string, updates: Partial<Pick<Announcement, 'title' | 'body' | 'durationHours'>>) => {
      await firebaseClient.updateAnnouncement(id, updates);
    },
    [],
  );

  const deleteAnnouncement = useCallback(async (id: string) => {
    await firebaseClient.deleteAnnouncement(id);
  }, []);

  const voteOnAnnouncementPoll = useCallback(
    async (announcementId: string, userId: string, optionId: string) => {
      await firebaseClient.voteOnAnnouncementPoll(announcementId, userId, optionId);
    },
    [],
  );

  const getAnnouncementsForGroup = useCallback(
    (groupId: string) => announcements.filter((a) => a.groupId === groupId),
    [announcements],
  );

  return {
    announcements,
    activeGroupId,
    isCreating,
    setActiveGroup,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    voteOnAnnouncementPoll,
    getAnnouncementsForGroup,
  };
});
