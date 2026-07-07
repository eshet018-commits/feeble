import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Calendar, Plus, Users, Settings, Repeat, UserPlus, LogOut, Zap, MessageCircle, Megaphone, Clock, Trash2, BarChart3, Check, Pencil } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
} from 'react-native';

import { useGroups } from '@/contexts/GroupContext';
import { useEvents } from '@/contexts/EventContext';
import { useAnnouncements } from '@/contexts/AnnouncementContext';
import { useUser } from '@/contexts/UserContext';
import { ExpandedEvent, Announcement, AnnouncementDuration } from '@/types/event';

type Tab = 'events' | 'announcements';

const DURATION_LABELS: Record<AnnouncementDuration, string> = {
  0: 'Never expires',
  6: '6h',
  24: '1d',
  72: '3d',
  168: '1w',
  720: '30d',
};

function formatExpiry(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const remaining = ts - now;
  if (remaining <= 0) return 'expired';
  if (remaining < 3_600_000) return `${Math.max(1, Math.floor(remaining / 60_000))}m left`;
  if (remaining < 86_400_000) return `${Math.floor(remaining / 3_600_000)}h left`;
  return `${Math.floor(remaining / 86_400_000)}d left`;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function AnnouncementPollView({
  announcementId,
  poll,
  userId,
  onVote,
}: {
  announcementId: string;
  poll: Announcement['poll'];
  userId: string;
  onVote: (announcementId: string, optionId: string) => void;
}) {
  if (!poll) return null;

  const votes = poll.votes || {};
  const totalVotes = Object.keys(votes).length;
  const userVote = userId ? votes[userId] : undefined;

  const countFor = (optionId: string): number =>
    Object.values(votes).filter((v) => v === optionId).length;

  return (
    <View style={styles.pollContainer}>
      <View style={styles.pollHeader}>
        <BarChart3 size={15} color="#007AFF" />
        <Text style={styles.pollQuestion}>{poll.question}</Text>
      </View>

      {poll.options.map((opt) => {
        const count = countFor(opt.id);
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const selected = userVote === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={styles.pollOptionRow}
            onPress={() => onVote(announcementId, opt.id)}
            activeOpacity={0.6}
          >
            <View style={[styles.pollOptionRadio, selected && styles.pollOptionRadioSelected]}>
              {selected && <Check size={12} color="#FFF" />}
            </View>
            <View style={styles.pollOptionBar}>
              <View
                style={[
                  styles.pollOptionFill,
                  selected && styles.pollOptionFillSelected,
                  { width: `${pct}%` },
                ]}
              />
              <View style={styles.pollOptionContent}>
                <Text
                  style={[styles.pollOptionText, selected && styles.pollOptionTextSelected]}
                  numberOfLines={1}
                >
                  {opt.text}
                </Text>
                <Text style={styles.pollOptionPct}>{pct}%</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.pollFooter}>
        <Text style={styles.pollFooterText}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </Text>
        <Text style={styles.pollVoteHint}>
          {userVote ? 'Tap to change your vote' : 'Tap an option to vote'}
        </Text>
      </View>
    </View>
  );
}

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById, isGroupAdmin, getMembersByGroupId, leaveGroup } = useGroups();
  const { expandRecurringEvents, getCategoryById } = useEvents();

  const group = getGroupById(id!);
  const isAdmin = isGroupAdmin(id!);
  const members = getMembersByGroupId(id!);
  const chatEnabled = group?.chatEnabled || false;

  const { setActiveGroup, getAnnouncementsForGroup, deleteAnnouncement, voteOnAnnouncementPoll } = useAnnouncements();
  const { userId } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('events');

  useEffect(() => {
    if (id) setActiveGroup(id);
  }, [id, setActiveGroup]);

  const groupAnnouncements = useMemo<Announcement[]>(
    () => id ? getAnnouncementsForGroup(id) : [],
    [id, getAnnouncementsForGroup],
  );

  const activeAnnouncement = useMemo(
    () => groupAnnouncements[0] || null,
    [groupAnnouncements],
  );

  const switchTab = (tab: Tab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  const handleDeleteAnnouncement = (a: Announcement) => {
    Alert.alert('Delete Announcement', `Remove "${a.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAnnouncement(a.id).catch((e) =>
          Alert.alert('Error', e?.message || 'Failed to delete announcement'),
        ),
      },
    ]);
  };

  const handleVote = (announcementId: string, optionId: string) => {
    if (!userId) return;
    voteOnAnnouncementPoll(announcementId, userId, optionId).catch((e) =>
      Alert.alert('Vote failed', e?.message || 'Could not register your vote.'),
    );
  };

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const future = new Date();
    future.setMonth(future.getMonth() + 2);
    return expandRecurringEvents(now, future, id).slice(0, 20);
  }, [expandRecurringEvents, id]);

  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: ExpandedEvent[] } = {};
    upcomingEvents.forEach(event => {
      const date = new Date(event.instanceDate).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
    });
    return groups;
  }, [upcomingEvents]);

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string, allDay: boolean) => {
    if (allDay) return 'All Day';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isEventActive = (event: ExpandedEvent): boolean => {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return now >= start && now <= end;
  };

  const handleSettings = () => {
    router.push(`/group/${id}/settings` as any);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group?.name}"? You will no longer have access to this group's events.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(id!);
              router.replace('/');
            } catch (error: any) {
              console.error('Failed to leave group:', error);
              Alert.alert('Error', error?.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const LivePulse = ({ event }: { event: ExpandedEvent }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }, [pulseAnim]);

    if (!isEventActive(event)) return null;

    return (
      <View style={styles.liveBadge}>
        <Animated.View style={{ opacity: pulseAnim }}>
          <Zap size={12} color="#22C55E" />
        </Animated.View>
        <Text style={styles.liveBadgeText}>LIVE</Text>
      </View>
    );
  };

  const renderEventCard = (event: ExpandedEvent) => {
    const category = getCategoryById(event.categoryId);
    const active = isEventActive(event);
    
    return (
      <TouchableOpacity
        key={`${event.id}-${event.instanceDate}`}
        style={[styles.eventCard, active && styles.eventCardActive]}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
        activeOpacity={0.7}
      >
        <View style={[styles.eventColorBar, active && styles.eventColorBarActive, { backgroundColor: category?.color || '#999' }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <View style={styles.eventTitleRow}>
              <Text style={[styles.eventTitle, active && styles.eventTitleActive]} numberOfLines={1}>
                {event.title}
              </Text>
              {event.isRecurring && (
                <Repeat size={14} color={active ? '#22C55E' : '#666'} style={styles.repeatIcon} />
              )}
            </View>
            <Text style={[styles.eventTime, active && styles.eventTimeActive]}>
              {formatTime(event.instanceDate, event.allDay)}
            </Text>
          </View>
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {event.description}
            </Text>
          )}
          <View style={styles.eventFooter}>
            <LivePulse event={event} />
            <View style={styles.categoryBadge}>
              <View style={[styles.categoryDot, { backgroundColor: category?.color || '#999' }]} />
              <Text style={styles.categoryText}>{category?.name || 'Uncategorized'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <View style={styles.headerButtons}>
              {chatEnabled && (
                <TouchableOpacity
                  onPress={() => router.push(`/group/${id}/chats` as any)}
                  style={styles.headerButton}
                >
                  <MessageCircle size={22} color="#007AFF" />
                </TouchableOpacity>
              )}
              {isAdmin ? (
                <TouchableOpacity
                  onPress={handleSettings}
                  style={styles.headerButton}
                >
                  <Settings size={22} color="#007AFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleLeaveGroup}
                  style={styles.headerButton}
                >
                  <LogOut size={22} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />

      <View style={styles.groupInfoBar}>
        <View style={styles.groupInfoContent}>
          <TouchableOpacity
            style={styles.membersButton}
            onPress={() => router.push(`/group/${id}/members` as any)}
          >
            <Users size={16} color="#666" />
            <Text style={styles.groupInfoText}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => router.push(`/group/${id}/invite` as any)}
            >
              <UserPlus size={16} color="#007AFF" />
              <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
          )}
        </View>
        {group.description && (
          <Text style={styles.groupDescription}>{group.description}</Text>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => switchTab('events')}
          activeOpacity={0.7}
        >
          <Calendar size={16} color={activeTab === 'events' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>Events</Text>
          {groupAnnouncements.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{groupAnnouncements.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'announcements' && styles.tabActive]}
          onPress={() => switchTab('announcements')}
          activeOpacity={0.7}
        >
          <Megaphone size={16} color={activeTab === 'announcements' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'announcements' && styles.tabTextActive]}>Announcements</Text>
          {groupAnnouncements.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'announcements' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'announcements' && styles.tabBadgeTextActive]}>{groupAnnouncements.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'events' ? (
          <>
            {activeAnnouncement && (
              <TouchableOpacity
                style={styles.pinnedBanner}
                onPress={() => switchTab('announcements')}
                activeOpacity={0.9}
              >
                <View style={styles.pinnedAccent} />
                <View style={styles.pinnedContent}>
                  <View style={styles.pinnedHeader}>
                    <Megaphone size={14} color="#007AFF" />
                    <Text style={styles.pinnedLabel}>PINNED ANNOUNCEMENT</Text>
                    <Text style={styles.pinnedTime}>{formatRelative(activeAnnouncement.createdAt)}</Text>
                  </View>
                  <Text style={styles.pinnedTitle} numberOfLines={1}>{activeAnnouncement.title}</Text>
                  <Text style={styles.pinnedBody} numberOfLines={2}>{activeAnnouncement.body}</Text>
                  <View style={styles.pinnedFooter}>
                    <View style={styles.pinnedExpiry}>
                      <Clock size={11} color={activeAnnouncement.durationHours === 0 ? '#8E8E93' : '#FF9500'} />
                      <Text style={[styles.pinnedExpiryText, activeAnnouncement.durationHours === 0 ? styles.pinnedExpiryNever : styles.pinnedExpiryTimed]}>
                        {activeAnnouncement.durationHours === 0 ? DURATION_LABELS[0] : formatExpiry(activeAnnouncement.expiresAt!)}
                      </Text>
                    </View>
                    <Text style={styles.pinnedMore}>Tap to view all</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {Object.keys(groupedEvents).length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={64} color="#CCC" strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No Events Yet</Text>
                <Text style={styles.emptySubtitle}>
                  {isAdmin 
                    ? 'Create your first event to get started' 
                    : 'No events have been created yet'}
                </Text>
              </View>
            ) : (
              Object.keys(groupedEvents).map(dateString => (
                <View key={dateString} style={styles.dateSection}>
                  <Text style={styles.dateHeader}>{formatDateHeader(dateString)}</Text>
                  {groupedEvents[dateString].map(renderEventCard)}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {groupAnnouncements.length === 0 ? (
              <View style={styles.emptyState}>
                <Megaphone size={64} color="#CCC" strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No Announcements</Text>
                <Text style={styles.emptySubtitle}>
                  {isAdmin
                    ? 'Post an announcement to keep your group informed.'
                    : 'Check back later for updates from the admins.'}
                </Text>
              </View>
            ) : (
              groupAnnouncements.map(a => (
                <View key={a.id} style={styles.annCard}>
                  <View style={styles.annAccent} />
                  <View style={styles.annBody}>
                    <View style={styles.annHeader}>
                      <Text style={styles.annTitle}>{a.title}</Text>
                      {isAdmin && (
                        <View style={styles.annActions}>
                          <TouchableOpacity
                            onPress={() => router.push(`/group/${id}/create-announcement?announcementId=${a.id}` as any)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Pencil size={16} color="#007AFF" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteAnnouncement(a)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Trash2 size={18} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <Text style={styles.annBodyText}>{a.body}</Text>

                    {a.poll && (
                      <AnnouncementPollView
                        announcementId={a.id}
                        poll={a.poll}
                        userId={userId}
                        onVote={handleVote}
                      />
                    )}

                    <View style={styles.annMeta}>
                      <View style={styles.annAuthorRow}>
                        <View style={styles.annAuthorBadge}>
                          <Text style={styles.annAuthorInitial}>
                            {(a.createdByName || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.annAuthorName}>{a.createdByName}</Text>
                        <Text style={styles.annDot}>·</Text>
                        <Text style={styles.annTime}>{formatRelative(a.createdAt)}</Text>
                      </View>
                      <View style={[styles.annExpiry, a.durationHours === 0 ? styles.annExpiryNever : styles.annExpiryTimed]}>
                        <Clock size={12} color={a.durationHours === 0 ? '#8E8E93' : '#FF9500'} />
                        <Text style={[styles.annExpiryText, a.durationHours === 0 ? styles.annExpiryTextNever : styles.annExpiryTextTimed]}>
                          {a.durationHours === 0 ? DURATION_LABELS[0] : formatExpiry(a.expiresAt!)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, activeTab === 'announcements' && styles.fabAnnouncement]}
          onPress={() => router.push(
            activeTab === 'announcements'
              ? `/group/${id}/create-announcement` as any
              : `/group/${id}/create-event` as any
          )}
          activeOpacity={0.8}
        >
          {activeTab === 'announcements' ? (
            <Megaphone size={26} color="#FFF" strokeWidth={2.5} />
          ) : (
            <Plus size={28} color="#FFF" strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 8,
  },
  groupInfoBar: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  groupInfoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  groupInfoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F0FE',
    borderRadius: 16,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventColorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  eventTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
    flex: 1,
  },
  repeatIcon: {
    marginTop: 2,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventCardActive: {
    backgroundColor: '#F0FFF4',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  eventColorBarActive: {
    width: 4,
  },
  eventTitleActive: {
    color: '#166534',
  },
  eventTimeActive: {
    color: '#22C55E',
    fontWeight: '700' as const,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#166534',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabAnnouncement: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#F0F7FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#999',
  },
  tabTextActive: {
    color: '#007AFF',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: '#007AFF',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#666',
  },
  tabBadgeTextActive: {
    color: '#FFF',
  },
  pinnedBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  pinnedAccent: {
    width: 5,
    backgroundColor: '#007AFF',
  },
  pinnedContent: {
    flex: 1,
    padding: 14,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pinnedLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#007AFF',
    letterSpacing: 0.8,
    flex: 1,
  },
  pinnedTime: {
    fontSize: 11,
    color: '#999',
  },
  pinnedTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  pinnedBody: {
    fontSize: 14,
    color: '#444',
    lineHeight: 19,
    marginBottom: 10,
  },
  pinnedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pinnedExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinnedExpiryText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  pinnedExpiryNever: { color: '#8E8E93' },
  pinnedExpiryTimed: { color: '#FF9500' },
  pinnedMore: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  annCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  annAccent: { width: 5, backgroundColor: '#007AFF' },
  annBody: { flex: 1, padding: 16 },
  annHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  annActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginLeft: 10,
  },
  annTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#000',
    paddingRight: 8,
  },
  annBodyText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  annMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  annAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  annAuthorBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  annAuthorInitial: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  annAuthorName: { fontSize: 13, fontWeight: '600' as const, color: '#333' },
  annDot: { color: '#CCC' },
  annTime: { fontSize: 13, color: '#999' },
  annExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  annExpiryNever: { backgroundColor: '#F2F2F7' },
  annExpiryTimed: { backgroundColor: '#FFF4E5' },
  annExpiryText: { fontSize: 12, fontWeight: '600' as const },
  annExpiryTextNever: { color: '#8E8E93' },
  annExpiryTextTimed: { color: '#FF9500' },
  pollContainer: {
    backgroundColor: '#F8F9FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EEFF',
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  pollQuestion: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#000',
    flex: 1,
  },
  pollTotalVotes: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#8E8E93',
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  pollOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7D0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  pollOptionRadioSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  pollOptionBar: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#EAEAEA',
    overflow: 'hidden',
    position: 'relative',
  },
  pollOptionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,122,255,0.18)',
  },
  pollOptionFillSelected: {
    backgroundColor: 'rgba(0,122,255,0.30)',
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pollOptionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    fontWeight: '500' as const,
  },
  pollOptionTextSelected: {
    fontWeight: '700' as const,
    color: '#007AFF',
  },
  pollOptionPct: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#666',
  },
  pollFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollFooterText: {
    fontSize: 12,
    color: '#999',
  },
  pollVoteHint: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
});
