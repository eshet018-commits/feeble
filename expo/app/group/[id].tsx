import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Calendar, Plus, Users, Settings, Repeat, UserPlus, LogOut } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { useGroups } from '@/contexts/GroupContext';
import { useEvents } from '@/contexts/EventContext';
import { ExpandedEvent } from '@/types/event';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroupById, isGroupAdmin, getMembersByGroupId, leaveGroup } = useGroups();
  const { expandRecurringEvents, getCategoryById } = useEvents();

  const group = getGroupById(id!);
  const isAdmin = isGroupAdmin(id!);
  const members = getMembersByGroupId(id!);

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

  const renderEventCard = (event: ExpandedEvent) => {
    const category = getCategoryById(event.categoryId);
    
    return (
      <TouchableOpacity
        key={`${event.id}-${event.instanceDate}`}
        style={styles.eventCard}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
        activeOpacity={0.7}
      >
        <View style={[styles.eventColorBar, { backgroundColor: category?.color || '#999' }]} />
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <View style={styles.eventTitleRow}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {event.title}
              </Text>
              {event.isRecurring && (
                <Repeat size={14} color="#666" style={styles.repeatIcon} />
              )}
            </View>
            <Text style={styles.eventTime}>
              {formatTime(event.instanceDate, event.allDay)}
            </Text>
          </View>
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {event.description}
            </Text>
          )}
          <View style={styles.eventFooter}>
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

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>

      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/group/${id}/create-event` as any)}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#FFF" strokeWidth={2.5} />
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
});
