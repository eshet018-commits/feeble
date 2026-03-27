import { useLocalSearchParams, Stack } from 'expo-router';
import { Shield, ChevronRight, Crown } from 'lucide-react-native';
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
import { Member } from '@/types/event';

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { 
    getGroupById, 
    getMembersByGroupId, 
    getUserRoleInGroup, 
    isGroupCreator,
    promoteMember,
    demoteMember,
  } = useGroups();

  const group = getGroupById(id!);
  const members = getMembersByGroupId(id!);
  const userRole = getUserRoleInGroup(id!);
  const isCreator = isGroupCreator(id!);

  const { adminMembers, regularMembers, creatorMember } = useMemo(() => {
    const admins: Member[] = [];
    const regulars: Member[] = [];
    let creator: Member | undefined;

    members.forEach(member => {
      if (member.userId === group?.creatorId) {
        creator = member;
      } else if (member.role === 'admin') {
        admins.push(member);
      } else {
        regulars.push(member);
      }
    });

    return {
      adminMembers: admins,
      regularMembers: regulars,
      creatorMember: creator,
    };
  }, [members, group?.creatorId]);

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

  const handlePromoteMember = (member: Member) => {
    Alert.alert(
      'Promote Member',
      `Promote ${member.userName} to admin? They will be able to create events and manage members.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await promoteMember(id!, member.id);
              Alert.alert('Success', `${member.userName} is now an admin`);
            } catch (error: any) {
              console.error('Failed to promote member:', error);
              Alert.alert('Error', error?.message || 'Failed to promote member');
            }
          },
        },
      ]
    );
  };

  const handleDemoteMember = (member: Member) => {
    Alert.alert(
      'Demote Admin',
      `Remove admin privileges from ${member.userName}? They will become a regular member.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Demote',
          style: 'destructive',
          onPress: async () => {
            try {
              await demoteMember(id!, member.id);
              Alert.alert('Success', `${member.userName} is now a regular member`);
            } catch (error: any) {
              console.error('Failed to demote member:', error);
              Alert.alert('Error', error?.message || 'Failed to demote member');
            }
          },
        },
      ]
    );
  };

  const renderMemberCard = (member: Member, showActions: boolean, isAdmin: boolean, isCreator: boolean = false) => {
    return (
      <View key={member.id} style={styles.memberCard}>
        <View style={styles.memberInfo}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {member.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.memberDetails}>
            <View style={styles.nameRow}>
              <Text style={styles.memberName}>{member.userName}</Text>
              {isCreator && (
                <View style={styles.creatorBadge}>
                  <Crown size={12} color="#FFD700" />
                  <Text style={styles.badgeText}>Creator</Text>
                </View>
              )}
              {isAdmin && !isCreator && (
                <View style={styles.adminBadge}>
                  <Shield size={12} color="#007AFF" />
                  <Text style={styles.badgeText}>Admin</Text>
                </View>
              )}
            </View>
            <Text style={styles.memberJoined}>
              Joined {new Date(member.joinedAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric' 
              })}
            </Text>
          </View>
        </View>
        {showActions && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => isAdmin ? handleDemoteMember(member) : handlePromoteMember(member)}
          >
            <ChevronRight size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Members',
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {members.length} {members.length === 1 ? 'Member' : 'Members'}
          </Text>
        </View>

        {creatorMember && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Group Creator</Text>
            {renderMemberCard(creatorMember, false, true, true)}
          </View>
        )}

        {adminMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Admins</Text>
            {adminMembers.map(member => 
              renderMemberCard(
                member, 
                userRole === 'admin' && isCreator, 
                true
              )
            )}
          </View>
        )}

        {regularMembers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Members</Text>
            {regularMembers.map(member => 
              renderMemberCard(
                member, 
                userRole === 'admin', 
                false
              )
            )}
          </View>
        )}

        {userRole === 'viewer' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Only admins can see full member details and manage permissions.
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  memberDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#000',
  },
  memberJoined: {
    fontSize: 14,
    color: '#666',
  },
  actionButton: {
    padding: 8,
  },
  infoBox: {
    backgroundColor: '#E8F0FE',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
    textAlign: 'center',
  },
});
