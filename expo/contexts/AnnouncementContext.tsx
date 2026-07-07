import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useState } from 'react';
import { Announcement, AnnouncementDuration, AnnouncementPollInput } from '@/types/event';
import { firebaseClient } from '@/lib/firebase-client';

/**
 * Shared announcement state. Subscribes to announcements for the active group
 * so the group page and the announcements screen stay in sync.
 */
export const [AnnouncementProvider, useAnnouncements] = createContextHook(() => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Track the active group so both screens share one subscription.
  const setActiveGroup = useCallback((groupId: string | null) => {
    setActiveGroupId(groupId);
  }, []);

  useEffect(() => {
    if (!activeGroupId) {
      setAnnouncements([]);
      return;
    }
    const unsub = firebaseClient.subscribeToAnnouncements(activeGroupId, (list) => {
      setAnnouncements(list);
    });
    return () => unsub();
  }, [activeGroupId]);

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
