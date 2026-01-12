import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Calendar, Clock, Repeat, Tag, Bell, Plus, MapPin } from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
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
import { RepeatFrequency, EventReminder, EventLocation } from '@/types/event';
import { REMINDER_OPTIONS } from '@/constants/reminders';

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, updateEvent, categories, addCategory } = useEvents();

  const event = useMemo(() => {
    return events.find((e) => e.id === id);
  }, [events, id]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3600000));
  const [allDay, setAllDay] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '1');
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('none');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | undefined>(undefined);
  const [selectedReminders, setSelectedReminders] = useState<number[]>([]);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false);
  const [showCustomCategoryModal, setShowCustomCategoryModal] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryColor, setCustomCategoryColor] = useState('#3B82F6');
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setStartDate(new Date(event.startDate));
      setEndDate(new Date(event.endDate));
      setAllDay(event.allDay);
      setCategoryId(event.categoryId);
      setRepeatFrequency(event.repeatFrequency);
      setRepeatEndDate(event.repeatEndDate ? new Date(event.repeatEndDate) : undefined);
      setSelectedReminders(event.reminders.map(r => r.minutes));
      if (event.location) {
        setLocationAddress(event.location.address);
        setLocationCoords({
          latitude: event.location.latitude,
          longitude: event.location.longitude,
        });
      }
    }
  }, [event]);

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

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

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    try {
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

      await updateEvent(event.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        allDay,
        categoryId,
        repeatFrequency,
        repeatEndDate: repeatEndDate?.toISOString(),
        reminders,
        location,
      });

      Alert.alert('Success', 'Event updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update event');
    }
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

  const handleGeocodeLocation = async () => {
    if (!locationAddress.trim()) {
      setLocationCoords(null);
      return;
    }

    setIsGeocodingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationAddress)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setLocationCoords({
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        });
      } else {
        Alert.alert('Location Not Found', 'Could not find the specified location. Please try a different address.');
        setLocationCoords(null);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'Failed to geocode location. You can still save the event without updating the location.');
      setLocationCoords(null);
    } finally {
      setIsGeocodingLocation(false);
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
      <Stack.Screen options={{ title: 'Edit Event' }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <TextInput
            style={styles.titleInput}
            placeholder="Event Title"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
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
          <TextInput
            style={styles.locationInput}
            placeholder="Enter address or place name"
            placeholderTextColor="#999"
            value={locationAddress}
            onChangeText={setLocationAddress}
            onBlur={handleGeocodeLocation}
          />
          {isGeocodingLocation && (
            <Text style={styles.geocodingText}>Finding location...</Text>
          )}
          {locationCoords && (
            <View style={styles.locationConfirm}>
              <MapPin size={14} color="#10B981" />
              <Text style={styles.locationConfirmText}>Location verified</Text>
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
          style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!title.trim()}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
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
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#CCC',
  },
  saveButtonText: {
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
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
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
  },
});
