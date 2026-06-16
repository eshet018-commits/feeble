import { useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, Repeat, Tag, Bell, Plus, MapPin, BarChart3, X, Circle } from 'lucide-react-native';
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
import { Event, RepeatFrequency, EventReminder, EventLocation, PollOption } from '@/types/event';
import { REMINDER_OPTIONS } from '@/constants/reminders';

export default function CreateEventScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id?: string }>();
  const { addEvent, categories, addCategory, createPoll } = useEvents();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000));
  const [allDay, setAllDay] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '1');
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('none');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | undefined>(undefined);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([30]);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryColor, setCustomCategoryColor] = useState('#3B82F6');
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [locationSearchTimeout, setLocationSearchTimeout] = useState<number | null>(null);
  
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const repeatOptions: { label: string; value: RepeatFrequency }[] = [
    { label: 'Never', value: 'none' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  const colorOptions = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#10B981',
    '#F59E0B', '#EF4444', '#06B6D4', '#6366F1',
    '#F97316', '#84CC16', '#14B8A6', '#A855F7',
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

    let location: EventLocation | undefined;
    if (locationAddress.trim() && locationCoords) {
      location = {
        address: locationAddress.trim(),
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
      };
    }

    const eventId = Date.now().toString();
    const newEvent: Event = {
      id: eventId,
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
      location,
      hasPoll: pollEnabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addEvent(newEvent);

    if (pollEnabled && pollQuestion.trim()) {
      const validOptions: PollOption[] = pollOptions
        .filter((o: string) => o.trim())
        .map((text: string, i: number) => ({ id: `opt-${i}`, text: text.trim() }));
      if (validOptions.length >= 2) {
        await createPoll(eventId, pollQuestion.trim(), validOptions);
      }
    }

    router.back();
  };

  const toggleReminder = (minutes: number) => {
    if (selectedReminders.includes(minutes)) {
      setSelectedReminders(selectedReminders.filter(m => m !== minutes));
    } else {
      setSelectedReminders([...selectedReminders, minutes].sort((a, b) => a - b));
    }
  };

  const handleCreateCustomCategory = async () => {
    if (!customCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    const newCategory = {
      id: `custom-${Date.now()}`,
      name: customCategoryName.trim(),
      color: customCategoryColor,
    };

    await addCategory(newCategory);
    setCategoryId(newCategory.id);
    setCustomCategoryName('');
    setShowCustomCategoryModal(false);
  };

  const handleLocationSearch = async (query: string) => {
    setLocationAddress(query);
    setLocationCoords(null);

    if (locationSearchTimeout) {
      clearTimeout(locationSearchTimeout);
    }

    if (!query.trim()) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsGeocodingLocation(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          setLocationSuggestions(data);
          setShowLocationSuggestions(true);
        } else {
          setLocationSuggestions([]);
          setShowLocationSuggestions(false);
        }
      } catch (error) {
        console.error('Location search error:', error);
        setLocationSuggestions([]);
        setShowLocationSuggestions(false);
      } finally {
        setIsGeocodingLocation(false);
      }
    }, 300);

    setLocationSearchTimeout(timeout);
  };

  const handleSelectLocation = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setLocationAddress(suggestion.display_name);
    setLocationCoords({
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    });
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);
  };

  const handleClearLocation = () => {
    setLocationAddress('');
    setLocationCoords(null);
    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
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
            <TouchableOpacity
              style={styles.addCategoryButton}
              onPress={() => setShowCustomCategoryModal(true)}
            >
              <Plus size={16} color="#007AFF" />
              <Text style={styles.addCategoryText}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <MapPin size={20} color="#007AFF" />
            <Text style={styles.label}>Location (Optional)</Text>
          </View>
          <View>
            <TextInput
              style={styles.locationInput}
              placeholder="Search for a location..."
              placeholderTextColor="#999"
              value={locationAddress}
              onChangeText={handleLocationSearch}
              onFocus={() => {
                if (locationSuggestions.length > 0) {
                  setShowLocationSuggestions(true);
                }
              }}
            />
            {showLocationSuggestions && locationSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView 
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {locationSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectLocation(suggestion)}
                    >
                      <MapPin size={16} color="#666" />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {suggestion.display_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
          {isGeocodingLocation && (
            <Text style={styles.geocodingText}>Searching...</Text>
          )}
          {locationCoords && (
            <View style={styles.locationConfirm}>
              <MapPin size={14} color="#10B981" />
              <Text style={styles.locationConfirmText}>Location selected</Text>
              <TouchableOpacity onPress={handleClearLocation} style={styles.clearLocationButton}>
                <Text style={styles.clearLocationText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <BarChart3 size={20} color="#007AFF" />
            <Text style={styles.label}>Poll</Text>
            <Switch
              value={pollEnabled}
              onValueChange={setPollEnabled}
              trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
              thumbColor="#FFF"
              style={styles.pollSwitch}
            />
          </View>
          {pollEnabled && (
            <View style={styles.pollContent}>
              <TextInput
                style={styles.pollQuestionInput}
                placeholder="Ask a question..."
                placeholderTextColor="#999"
                value={pollQuestion}
                onChangeText={setPollQuestion}
              />
              {pollOptions.map((option, index) => (
                <View key={index} style={styles.pollOptionRow}>
                  <Circle size={8} color="#007AFF" style={styles.pollOptionDot} />
                  <TextInput
                    style={styles.pollOptionInput}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor="#999"
                    value={option}
                    onChangeText={(text) => {
                      const updated = [...pollOptions];
                      updated[index] = text;
                      setPollOptions(updated);
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity
                      style={styles.pollOptionRemove}
                      onPress={() => {
                        const updated = pollOptions.filter((_, i) => i !== index);
                        setPollOptions(updated);
                      }}
                    >
                      <X size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 10 && (
                <TouchableOpacity
                  style={styles.addPollOptionButton}
                  onPress={() => setPollOptions([...pollOptions, ''])}
                >
                  <Plus size={16} color="#007AFF" />
                  <Text style={styles.addPollOptionText}>Add option</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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

      {showCustomCategoryModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Custom Category</Text>
            <TextInput
              style={styles.categoryNameInput}
              placeholder="Category name"
              placeholderTextColor="#999"
              value={customCategoryName}
              onChangeText={setCustomCategoryName}
              autoFocus
            />
            <Text style={styles.colorLabel}>Select Color</Text>
            <View style={styles.colorGrid}>
              {colorOptions.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    customCategoryColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setCustomCategoryColor(color)}
                />
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCustomCategoryModal(false);
                  setCustomCategoryName('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalCreateButton,
                  !customCategoryName.trim() && styles.modalCreateButtonDisabled,
                ]}
                onPress={handleCreateCustomCategory}
                disabled={!customCategoryName.trim()}
              >
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addCategoryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 20,
    textAlign: 'center',
  },
  categoryNameInput: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#666',
  },
  modalCreateButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCreateButtonDisabled: {
    backgroundColor: '#CCC',
  },
  modalCreateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  pollSwitch: {
    marginLeft: 'auto',
  },
  pollContent: {
    marginTop: 12,
  },
  pollQuestionInput: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
    color: '#000',
    marginBottom: 12,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  pollOptionDot: {
    marginTop: 2,
  },
  pollOptionInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    fontSize: 15,
    color: '#000',
  },
  pollOptionRemove: {
    padding: 6,
  },
  addPollOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 4,
  },
  addPollOptionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  locationInput: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
    color: '#000',
  },
  geocodingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  locationConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  locationConfirmText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500' as const,
    flex: 1,
  },
  clearLocationButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearLocationText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 200,
    zIndex: 1000,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
});
