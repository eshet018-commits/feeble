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
      for (const ann of list) {
        if (knownAnnouncementIds.current.has(ann.id)) continue;
        knownAnnouncementIds.current.add(ann.id);
        if (knownAnnouncementIds.current.size > 500) {
          knownAnnouncementIds.current = new Set(
            Array.from(knownAnnouncementIds.current).slice(-300),
          );
        }
        // Skip announcements created by the current user.
        if (ann.createdBy === userId) continue;
        // Skip announcements the user has already seen.
        if (await isAnnouncementSeen(userId, ann.id)) continue;

        // Instant in-app banner (works on all platforms, including web).
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
  }, [userId, groupIdsKey]);

  useEffect(() => {
    if (!activeGroupId) {
      setAnnouncements([]);
      return;
    }
    const unsub = firebaseClient.subscribeToAnnouncements(activeGroupId, (list) => {
      setAnnouncements(list);
      // Mark all currently visible announcements as seen so we don't
      // notify about them when the background listener fires.
      if (userId) {
        list.forEach((a) => {
          if (!knownAnnouncementIds.current.has(a.id)) {
            knownAnnouncementIds.current.add(a.id);
          }
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
        return await firebaseClient.createAnnouncement(data);
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
