import { useRouter, Redirect } from 'expo-router';
import { Users, Plus, ChevronRight, UserPlus, User } from 'lucide-react-native';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroups } from '@/contexts/GroupContext';
import { useUser } from '@/contexts/UserContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import OnboardingOverlay from '@/components/OnboardingOverlay';

export default function GroupsListScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: userLoading } = useUser();
  const { getUserGroups, isGroupAdmin, getMembersByGroupId } = useGroups();
  const { registerView } = useOnboarding();

  const userGroups = getUserGroups();

  if (userLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  return (
    <View style={styles.container}>
      <OnboardingOverlay />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Groups</Text>
            <Text style={styles.headerSubtitle}>
              {userGroups.length} {userGroups.length === 1 ? 'group' : 'groups'}
            </Text>
          </View>
          <TouchableOpacity
            ref={registerView('profile')}
            style={styles.settingsButton}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
          >
            <User size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {userGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={64} color="#CCC" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first group to start managing events
            </Text>
            <TouchableOpacity
              style={styles.joinGroupButton}
              onPress={() => router.push('/join-group')}
              activeOpacity={0.7}
            >
              <UserPlus size={20} color="#007AFF" />
              <Text style={styles.joinGroupButtonText}>Join a Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          userGroups.map(group => {
            const members = getMembersByGroupId(group.id);
            const isAdmin = isGroupAdmin(group.id);
            
            return (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.groupIconContainer}>
                  <Users size={28} color="#007AFF" />
                </View>
                <View style={styles.groupInfo}>
                  <View style={styles.groupTitleRow}>
                    <Text style={styles.groupTitle} numberOfLines={1}>
                      {group.name}
                    </Text>
                    {isAdmin && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    )}
                  </View>
                  {group.description && (
                    <Text style={styles.groupDescription} numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}
                  <View style={styles.groupFooter}>
                    <Text style={styles.membersCount}>
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#CCC" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <TouchableOpacity
          ref={registerView('join-group')}
          style={styles.fabSecondary}
          onPress={() => router.push('/join-group')}
          activeOpacity={0.8}
        >
          <UserPlus size={24} color="#007AFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <TouchableOpacity
          ref={registerView('create-group')}
          style={styles.fab}
          onPress={() => router.push('/create-group')}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#FFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  groupIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
    flex: 1,
  },
  adminBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  groupDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  membersCount: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500' as const,
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
    marginBottom: 24,
  },
  joinGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F0FE',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  joinGroupButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-end',
  },
  fabSecondary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  fab: {
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
