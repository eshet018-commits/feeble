import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroups } from '@/contexts/GroupContext';
import { useUser } from '@/contexts/UserContext';
import { isConfigured, firestore } from '@/backend/firebase';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { createGroup } = useGroups();
  const { userId } = useUser();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const info = `Firebase Configured: ${isConfigured}\nFirestore: ${!!firestore}\nUserId: ${userId}\nCreateGroup: ${!!createGroup}`;
    setDebugInfo(info);
    console.log('[CreateGroup] Debug Info:', info);
  }, [userId, createGroup]);

  console.log('[CreateGroup] Component rendered, createGroup available:', !!createGroup);

  const handleCreate = async () => {
    console.log('[CreateGroup] Button pressed', { name: name.trim(), isCreating });
    
    if (!name.trim()) {
      console.log('[CreateGroup] Name is empty, aborting');
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    
    if (isCreating) {
      console.log('[CreateGroup] Already creating, aborting');
      return;
    }

    setIsCreating(true);
    console.log('[CreateGroup] Starting group creation...');
    
    try {
      if (!createGroup) {
        throw new Error('createGroup function is not available');
      }
      
      console.log('[CreateGroup] Calling createGroup with:', { name: name.trim(), description: description.trim() });
      const newGroup = await createGroup(name.trim(), description.trim() || undefined);
      console.log('[CreateGroup] Group created successfully:', newGroup);
      
      if (!newGroup || !newGroup.id) {
        throw new Error('Group creation returned invalid data');
      }
      
      console.log('[CreateGroup] Navigating to group page...');
      router.replace({ pathname: '/group/[id]', params: { id: newGroup.id } });
      console.log('[CreateGroup] Navigation complete');
    } catch (error: any) {
      console.error('[CreateGroup] Error creating group:', error);
      console.error('[CreateGroup] Error stack:', error?.stack);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      Alert.alert('Error', `Failed to create group: ${errorMessage}`);
    } finally {
      setIsCreating(false);
      console.log('[CreateGroup] Finished (isCreating reset)');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!name.trim() || isCreating}
            style={styles.createButton}
          >
            {isCreating ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text
                style={[
                  styles.createText,
                  !name.trim() && styles.createTextDisabled,
                ]}
              >
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.label}>Group Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter group name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={50}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What is this group for?"
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={200}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Groups</Text>
          <Text style={styles.infoText}>
            • As the admin, you can create and manage events in this group
          </Text>
          <Text style={styles.infoText}>
            • Invite members to view events and receive notifications
          </Text>
          <Text style={styles.infoText}>
            • Only admins can create, edit, or delete events
          </Text>
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Info</Text>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  safeArea: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  createButton: {
    paddingVertical: 8,
  },
  createText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  createTextDisabled: {
    color: '#CCC',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 17,
    color: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  infoSection: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
  },
  debugSection: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  debugTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FF6B6B',
    marginBottom: 12,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
