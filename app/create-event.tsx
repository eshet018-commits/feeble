import { useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, Repeat, Tag, Bell } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvents } from '@/contexts/EventContext';
import { Event, RepeatFrequency, EventReminder } from '@/types/event';
import { REMINDER_OPTIONS } from '@/constants/reminders';

export default function CreateEventScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id?: string }>();
  const { addEvent, categories } = useEvents();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000));
  const [allDay, setAllDay] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '1');
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('none');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | undefined>(undefined);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([30]);
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);

  const repeatOptions: { label: string; value: RepeatFrequency }[] = [
    { label: 'Never', value: 'none' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  const handleCreate = async () => {
    if (!title.trim()) {
      return;
    }

    if (!groupId) {
      Alert.alert('Error', 'Group ID is required to create an event');
      return;
    }

    const reminders: EventReminder[] = selectedReminders.map((minutes, index) => ({
      id: `reminder-${index}`,
      minutes,
      enabled: true,
    }));

    const newEvent: Event = {
      id: Date.now().toString(),
      groupId,
      title: title.trim(),
      description: description.trim() || undefined,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      allDay,
      categoryId,
      repeatFrequency,
      repeatEndDate: repeatEndDate?.toISOString(),
      attachments: [],
      reminders,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addEvent(newEvent);
    router.back();
  };

  const toggleReminder = (minutes: number) => {
    if (selectedReminders.includes(minutes)) {
      setSelectedReminders(selectedReminders.filter(m => m !== minutes));
    } else {
      setSelectedReminders([...selectedReminders, minutes].sort((a, b) => a - b));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <TextInput
            style={styles.titleInput}
            placeholder="Event Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
        </View>

        <View style={styles.section}>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Add description..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Calendar size={20} color="#007AFF" />
            <Text style={styles.label}>Start</Text>
          </View>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
            {!allDay && (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>{formatTime(startDate)}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Clock size={20} color="#007AFF" />
            <Text style={styles.label}>End</Text>
          </View>
          <View style={styles.dateTimeRow}>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
            </TouchableOpacity>
            {!allDay && (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>{formatTime(endDate)}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>All Day</Text>
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Repeat size={20} color="#007AFF" />
            <Text style={styles.label}>Repeat</Text>
          </View>
          <View style={styles.optionsGrid}>
            {repeatOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  repeatFrequency === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setRepeatFrequency(option.value)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    repeatFrequency === option.value && styles.optionButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {repeatFrequency !== 'none' && (
            <TouchableOpacity
              style={styles.repeatEndButton}
              onPress={() => setShowRepeatEndDatePicker(true)}
            >
              <Text style={styles.repeatEndLabel}>
                Repeat until: {repeatEndDate ? formatDate(repeatEndDate) : 'Never'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Tag size={20} color="#007AFF" />
            <Text style={styles.label}>Category</Text>
          </View>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  categoryId === category.id && {
                    backgroundColor: category.color + '20',
                    borderColor: category.color,
                  },
                ]}
                onPress={() => setCategoryId(category.id)}
              >
                <View
                  style={[styles.categoryDot, { backgroundColor: category.color }]}
                />
                <Text
                  style={[
                    styles.categoryButtonText,
                    categoryId === category.id && { color: category.color },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Bell size={20} color="#007AFF" />
            <Text style={styles.label}>Reminders</Text>
          </View>
          <View style={styles.reminderList}>
            {REMINDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.minutes}
                style={[
                  styles.reminderButton,
                  selectedReminders.includes(option.minutes) && styles.reminderButtonActive,
                ]}
                onPress={() => toggleReminder(option.minutes)}
              >
                <Text
                  style={[
                    styles.reminderButtonText,
                    selectedReminders.includes(option.minutes) &&
                      styles.reminderButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, !title.trim() && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!title.trim()}
        >
          <Text style={styles.createButtonText}>Create Event</Text>
        </TouchableOpacity>
      </View>

      {showStartDatePicker && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowStartDatePicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowStartDatePicker(false);
              if (date) setStartDate(date);
            }}
            textColor="#000"
          />
        </View>
      )}

      {showStartTimePicker && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={startDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowStartTimePicker(false);
              if (date) setStartDate(date);
            }}
            textColor="#000"
          />
        </View>
      )}

      {showEndDatePicker && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowEndDatePicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowEndDatePicker(false);
              if (date) setEndDate(date);
            }}
            textColor="#000"
          />
        </View>
      )}

      {showEndTimePicker && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={endDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowEndTimePicker(false);
              if (date) setEndDate(date);
            }}
            textColor="#000"
          />
        </View>
      )}

      {showRepeatEndDatePicker && (
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowRepeatEndDatePicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={repeatEndDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              if (Platform.OS === 'android') setShowRepeatEndDatePicker(false);
              if (date) setRepeatEndDate(date);
            }}
            textColor="#000"
          />
        </View>
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
    padding: 20,
    paddingBottom: 120,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: '#000',
  },
  descriptionInput: {
    fontSize: 16,
    color: '#000',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500' as const,
  },
  timeButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500' as const,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#666',
  },
  optionButtonTextActive: {
    color: '#FFF',
  },
  repeatEndButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  repeatEndLabel: {
    fontSize: 14,
    color: '#666',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
  },
  reminderList: {
    gap: 8,
  },
  reminderButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reminderButtonActive: {
    backgroundColor: '#E8F0FE',
    borderColor: '#007AFF',
  },
  reminderButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#666',
  },
  reminderButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#CCC',
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  pickerContainer: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
});
