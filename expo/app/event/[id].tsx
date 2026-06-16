import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  Clock,
  Repeat,
  Tag,
  Bell,
  Trash2,
  Edit3,
  MapPin,
  Zap,
  BarChart3,
  Check,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useEvents } from '@/contexts/EventContext';
import { useGroups } from '@/contexts/GroupContext';
import { useUser } from '@/contexts/UserContext';
import { PollOption } from '@/types/event';
import { REMINDER_OPTIONS } from '@/constants/reminders';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, getCategoryById, deleteEvent, getPoll, subscribeToPoll, voteOnPoll } = useEvents();
  const { getUserRoleInGroup } = useGroups();
  const { userId } = useUser();

  const event = useMemo(() => {
    return events.find((e) => e.id === id);
  }, [events, id]);

  const userRole = event?.groupId ? getUserRoleInGroup(event.groupId) : 'viewer';
  const isGroupAdmin = userRole === 'admin';

  const isEventActive = useMemo(() => {
    if (!event) return false;
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return now >= start && now <= end;
  }, [event]);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!event) return;
    const unsub = subscribeToPoll(event.id);
    return () => unsub();
  }, [event?.id, subscribeToPoll]);

  useEffect(() => {
    if (!isEventActive) return;
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
  }, [isEventActive, pulseAnim]);

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  const category = getCategoryById(event.categoryId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getRepeatLabel = () => {
    switch (event.repeatFrequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return 'Does not repeat';
    }
  };

  const poll = getPoll(event.id);

  const handleVote = async (optionId: string) => {
    if (!poll || !userId) return;
    try {
      await voteOnPoll(event.id, userId, optionId);
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEvent(event.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isEventActive && (
          <View style={styles.activeBanner}>
            <Animated.View style={{ opacity: pulseAnim, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Zap size={16} color="#FFF" />
            </Animated.View>
            <Text style={styles.activeBannerText}>Happening Now</Text>
          </View>
        )}
        <View style={[styles.header, { backgroundColor: category?.color || '#999' }]}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {event.description && (
            <Text style={styles.eventDescription}>{event.description}</Text>
          )}
        </View>

        {poll && (
          <View style={styles.pollSection}>
            <View style={styles.pollHeader}>
              <BarChart3 size={20} color="#007AFF" />
              <Text style={styles.pollTitle}>Poll</Text>
            </View>
            <Text style={styles.pollQuestion}>{poll.question}</Text>
            {(() => {
              const totalVotes = Object.keys(poll.votes).length;
              const userVote = userId ? poll.votes[userId] : null;
              return (
                <>
                  {poll.options.map((option: PollOption) => {
                    const voteCount = Object.values(poll.votes).filter((v: string) => v === option.id).length;
                    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                    const isSelected = userVote === option.id;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.pollOption,
                          isSelected && styles.pollOptionSelected,
                        ]}
                        onPress={() => handleVote(option.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.pollOptionContent}>
                          <View style={styles.pollOptionLeft}>
                            <View style={[
                              styles.pollRadio,
                              isSelected && styles.pollRadioSelected,
                            ]}>
                              {isSelected && <Check size={12} color="#FFF" />}
                            </View>
                            <Text style={[
                              styles.pollOptionText,
                              isSelected && styles.pollOptionTextSelected,
                            ]}>
                              {option.text}
                            </Text>
                          </View>
                          {totalVotes > 0 && (
                            <Text style={styles.pollPercentage}>{percentage}%</Text>
                          )}
                        </View>
                        <View style={styles.pollProgressTrack}>
                          <View style={[
                            styles.pollProgressFill,
                            { width: totalVotes > 0 ? `${percentage}%` as any : '0%' as any },
                            isSelected && styles.pollProgressFillSelected,
                          ]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.pollTotalVotes}>
                    {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                  </Text>
                </>
              );
            })()}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Calendar size={20} color="#007AFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Start</Text>
              <Text style={styles.infoValue}>
                {formatDate(event.startDate)}
                {!event.allDay && ` at ${formatTime(event.startDate)}`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Clock size={20} color="#007AFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>End</Text>
              <Text style={styles.infoValue}>
                {formatDate(event.endDate)}
                {!event.allDay && ` at ${formatTime(event.endDate)}`}
              </Text>
            </View>
          </View>
        </View>

        {event.allDay && (
          <View style={styles.section}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>All Day Event</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Repeat size={20} color="#007AFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Repeat</Text>
              <Text style={styles.infoValue}>{getRepeatLabel()}</Text>
              {event.repeatEndDate && (
                <Text style={styles.infoSubValue}>
                  Until {formatDate(event.repeatEndDate)}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Tag size={20} color="#007AFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Category</Text>
              <View style={styles.categoryBadge}>
                <View
                  style={[styles.categoryDot, { backgroundColor: category?.color || '#999' }]}
                />
                <Text style={styles.categoryName}>{category?.name || 'Uncategorized'}</Text>
              </View>
            </View>
          </View>
        </View>

        {event.reminders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <Bell size={20} color="#007AFF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Reminders</Text>
                {event.reminders.map((reminder) => {
                  const option = REMINDER_OPTIONS.find((o) => o.minutes === reminder.minutes);
                  return (
                    <Text key={reminder.id} style={styles.reminderItem}>
                      • {option?.label || `${reminder.minutes} minutes before`}
                    </Text>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {event.location && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <MapPin size={20} color="#007AFF" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{event.location.address}</Text>
              </View>
            </View>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: event.location.latitude,
                  longitude: event.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: event.location.latitude,
                    longitude: event.location.longitude,
                  }}
                  title={event.title}
                  description={event.location.address}
                />
              </MapView>
            </View>
          </View>
        )}
      </ScrollView>

      {isGroupAdmin && (
        <SafeAreaView style={styles.footer} edges={['bottom']}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => router.push(`/event/${id}/edit`)}
            >
              <Edit3 size={20} color="#007AFF" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Trash2 size={20} color="#FF3B30" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },
  eventTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 17,
    color: '#FFF',
    opacity: 0.95,
    lineHeight: 24,
  },
  pollSection: {
    backgroundColor: '#FFF',
    marginTop: 1,
    padding: 20,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#000',
  },
  pollQuestion: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 16,
  },
  pollOption: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pollOptionSelected: {
    backgroundColor: '#E8F0FE',
    borderColor: '#007AFF',
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pollOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pollRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pollRadioSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pollOptionText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500' as const,
    flex: 1,
  },
  pollOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '700' as const,
  },
  pollPercentage: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#666',
  },
  pollProgressTrack: {
    height: 6,
    backgroundColor: '#E5E5E5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  pollProgressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  pollProgressFillSelected: {
    backgroundColor: '#007AFF',
  },
  pollTotalVotes: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 1,
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500' as const,
  },
  infoSubValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500' as const,
  },
  reminderItem: {
    fontSize: 15,
    color: '#000',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    padding: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  editButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
  },
  mapContainer: {
    marginTop: 12,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22C55E',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  activeBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
