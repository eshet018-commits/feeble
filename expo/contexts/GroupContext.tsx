import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useState, useEffect } from 'react';
import { Group, JoinGroupResult, Member } from '@/types/event';
import { useUser } from './UserContext';
import { database, isConfigured } from '@/backend/firebase';
import {
  ref,
  set,
  get,
  update,
  remove,
  onValue,
} from 'firebase/database';

async function generateInviteCode(db: any): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = 'group-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const groupsRef = ref(db, 'groups');
    const groupsSnapshot = await get(groupsRef);
    
    if (!groupsSnapshot.exists()) {
      return code;
    }

    const groupsData = groupsSnapshot.val();
    const existingCodes = Object.values(groupsData).map((g: any) => g.inviteCode);
    
    if (!existingCodes.includes(code)) {
      return code;
    }
    
    attempts++;
  }

  throw new Error('Failed to generate unique invite code');
}

async function isInviteCodeAvailable(db: any, code: string, excludeGroupId?: string): Promise<boolean> {
  const groupsRef = ref(db, 'groups');
  const groupsSnapshot = await get(groupsRef);
  
  if (!groupsSnapshot.exists()) {
    return true;
  }

  const groupsData = groupsSnapshot.val();
  const matchingGroups = Object.entries(groupsData).filter(
    ([id, data]: [string, any]) => data.inviteCode === code
  );

  if (matchingGroups.length === 0) {
    return true;
  }

  if (excludeGroupId) {
    return matchingGroups.length === 1 && matchingGroups[0][0] === excludeGroupId;
  }

  return false;
}

export const [GroupProvider, useGroups] = createContextHook(() => {
  const { userId, userName } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !isConfigured || !database) {
      setIsLoading(false);
      return;
    }

    console.log('Setting up Realtime Database listeners for user:', userId);
    setIsLoading(true);

    const membersRef = ref(database, 'members');
    const groupsRef = ref(database, 'groups');
    
    const unsubscribeMembers = onValue(membersRef, async (snapshot) => {
      console.log('Members snapshot received');
      
      if (!snapshot.exists()) {
        setAllMembers([]);
        setGroups([]);
        setIsLoading(false);
        return;
      }

      const membersData = snapshot.val();
      const membersList = Object.entries(membersData)
        .map(([id, data]: [string, any]) => ({ id, ...data } as Member))
        .filter(m => m.userId === userId);

      if (membersList.length === 0) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      const groupIds = membersList.map(m => m.groupId);
      const groupsSnapshot = await get(groupsRef);
      
      if (!groupsSnapshot.exists()) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      const groupsData = groupsSnapshot.val();
      const userGroups = Object.entries(groupsData)
        .map(([id, data]: [string, any]) => ({ id, ...data } as Group))
        .filter(g => groupIds.includes(g.id));
      
      console.log('User groups loaded:', userGroups.length);
      setGroups(userGroups);

      const allMembersData = membersData;
      const allMembersList = Object.entries(allMembersData)
        .map(([id, data]: [string, any]) => ({ id, ...data } as Member))
        .filter(m => groupIds.includes(m.groupId));
      
      setAllMembers(allMembersList);
      setIsLoading(false);
    });

    const unsubscribeGroups = onValue(groupsRef, async (snapshot) => {
      console.log('Groups snapshot received');
      
      if (!snapshot.exists()) {
        setGroups([]);
        return;
      }

      const membersSnapshot = await get(membersRef);
      if (!membersSnapshot.exists()) {
        setGroups([]);
        return;
      }

      const membersData = membersSnapshot.val();
      const membersList = Object.entries(membersData)
        .map(([id, data]: [string, any]) => ({ id, ...data } as Member))
        .filter(m => m.userId === userId);

      if (membersList.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = membersList.map(m => m.groupId);
      const groupsData = snapshot.val();
      const userGroups = Object.entries(groupsData)
        .map(([id, data]: [string, any]) => ({ id, ...data } as Group))
        .filter(g => groupIds.includes(g.id));
      
      console.log('Groups updated, refreshing user groups:', userGroups.length);
      setGroups(userGroups);

      const allMembersList = Object.entries(membersData)
        .map(([id, data]: [string, any]) => ({ id, ...data } as Member))
        .filter(m => groupIds.includes(m.groupId));
      
      setAllMembers(allMembersList);
    });

    return () => {
      console.log('Cleaning up Realtime Database listeners');
      unsubscribeMembers();
      unsubscribeGroups();
    };
  }, [userId]);

  const createGroup = useCallback(async (name: string, description?: string) => {
    console.log('[GroupContext] createGroup called', { name, description, userId, isConfigured, hasDatabase: !!database });
    
    if (!isConfigured || !database) {
      console.error('[GroupContext] Firebase not configured:', { isConfigured, hasDatabase: !!database });
      throw new Error('Firebase is not configured. Please check your environment variables.');
    }
    
    if (!userId) {
      console.error('[GroupContext] No userId available');
      throw new Error('User ID is required to create a group');
    }
    
    console.log('[GroupContext] Creating group:', { name, description, adminId: userId });
    
    const inviteCode = await generateInviteCode(database);
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const group: Group = {
      id: groupId,
      name,
      description: description || '',
      adminId: userId,
      creatorId: userId,
      inviteCode,
      chatEnabled: false,
      createdAt: now,
      updatedAt: now,
    };

    await set(ref(database, `groups/${groupId}`), group);
    console.log('[GroupContext] Group written to database');

    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const member: Member = {
      id: memberId,
      userId,
      userName,
      groupId,
      role: 'admin',
      joinedAt: now,
    };

    await set(ref(database, `members/${memberId}`), member);
    console.log('[GroupContext] Member written to database');

    console.log('[GroupContext] Group created successfully:', groupId);
    return group;
  }, [userId, userName]);

  const updateGroup = useCallback(async (groupId: string, updates: Partial<Group>) => {
    if (!isConfigured || !database) {
      throw new Error('Firebase is not configured');
    }
    console.log('Updating group:', { groupId, updates });
    
    if (updates.inviteCode) {
      const isAvailable = await isInviteCodeAvailable(database, updates.inviteCode, groupId);
      if (!isAvailable) {
        throw new Error('This invite code is already in use by another group');
      }
    }

    const filteredUpdates: any = {
      updatedAt: new Date().toISOString(),
    };
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    });
    
    const groupRef = ref(database, `groups/${groupId}`);
    await update(groupRef, filteredUpdates);
    console.log('Group updated successfully');
  }, []);

  const deleteGroup = useCallback(async (groupId: string) => {
    if (!isConfigured || !database) {
      throw new Error('Firebase is not configured');
    }
    console.log('Deleting group:', groupId);
    
    const membersRef = ref(database, 'members');
    const membersSnapshot = await get(membersRef);
    
    if (membersSnapshot.exists()) {
      const membersData = membersSnapshot.val();
      for (const [memberId, memberData] of Object.entries(membersData)) {
        if ((memberData as Member).groupId === groupId) {
          await remove(ref(database, `members/${memberId}`));
        }
      }
    }

    await remove(ref(database, `groups/${groupId}`));
    
    console.log('Group deleted');
  }, []);

  const getGroupById = useCallback((groupId: string) => {
    return groups.find(g => g.id === groupId);
  }, [groups]);

  const getMembersByGroupId = useCallback((groupId: string) => {
    return allMembers.filter(m => m.groupId === groupId);
  }, [allMembers]);

  const getUserGroups = useCallback(() => {
    return groups;
  }, [groups]);

  const getUserRoleInGroup = useCallback((groupId: string) => {
    const member = allMembers.find(m => m.groupId === groupId && m.userId === userId);
    return member?.role || 'viewer';
  }, [allMembers, userId]);

  const isGroupAdmin = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group?.adminId === userId) return true;
    return getUserRoleInGroup(groupId) === 'admin';
  }, [groups, userId, getUserRoleInGroup]);

  const isGroupCreator = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    return group?.creatorId === userId;
  }, [groups, userId]);

  const promoteMember = useCallback(async (groupId: string, memberId: string) => {
    if (!isConfigured || !database) {
      throw new Error('Firebase is not configured');
    }
    
    const userRole = getUserRoleInGroup(groupId);
    if (userRole !== 'admin') {
      throw new Error('Only admins can promote members');
    }
    
    console.log('Promoting member:', { groupId, memberId });
    await update(ref(database, `members/${memberId}`), { role: 'admin' });
    console.log('Member promoted successfully');
  }, [getUserRoleInGroup]);

  const demoteMember = useCallback(async (groupId: string, memberId: string) => {
    if (!isConfigured || !database) {
      throw new Error('Firebase is not configured');
    }
    
    if (!isGroupCreator(groupId)) {
      throw new Error('Only the group creator can demote admins');
    }
    
    const group = groups.find(g => g.id === groupId);
    const member = allMembers.find(m => m.id === memberId);
    
    if (member?.userId === group?.creatorId) {
      throw new Error('Cannot demote the group creator');
    }
    
    console.log('Demoting member:', { groupId, memberId });
    await update(ref(database, `members/${memberId}`), { role: 'viewer' });
    console.log('Member demoted successfully');
  }, [groups, allMembers, isGroupCreator]);

  const joinGroupWithCode = useCallback(async (inviteCode: string): Promise<JoinGroupResult> => {
    if (!isConfigured || !database) {
      return { success: false, error: 'Firebase is not configured' };
    }
    console.log('Joining group with code:', inviteCode);
    try {
      const groupsRef = ref(database, 'groups');
      const groupsSnapshot = await get(groupsRef);
      
      if (!groupsSnapshot.exists()) {
        return { success: false, error: 'Invalid group code' };
      }

      const groupsData = groupsSnapshot.val();
      const matchingGroupEntry = Object.entries(groupsData).find(
        ([_, data]: [string, any]) => data.inviteCode?.toUpperCase() === inviteCode.toUpperCase()
      );

      if (!matchingGroupEntry) {
        return { success: false, error: 'Invalid group code' };
      }

      const [groupId, groupData] = matchingGroupEntry;
      const group = groupData as Group;

      const membersRef = ref(database, 'members');
      const membersSnapshot = await get(membersRef);

      if (membersSnapshot.exists()) {
        const membersData = membersSnapshot.val();
        const existingMember = Object.values(membersData).find(
          (m: any) => m.userId === userId && m.groupId === groupId
        );

        if (existingMember) {
          return { success: false, error: 'You are already a member of this group' };
        }
      }

      const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const member: Member = {
        id: memberId,
        userId,
        userName,
        groupId,
        role: 'viewer',
        joinedAt: new Date().toISOString(),
      };

      await set(ref(database, `members/${memberId}`), member);

      console.log('Successfully joined group:', groupId);
      return { success: true, groupId, groupName: group.name };
    } catch (error: any) {
      console.error('Join group error:', error);
      const errorMessage = error?.message || error?.toString() || 'Failed to join group';
      return { success: false, error: errorMessage };
    }
  }, [userId, userName]);

  const toggleChatEnabled = useCallback(async (groupId: string, enabled: boolean) => {
    if (!isConfigured || !database) {
      throw new Error('Firebase is not configured');
    }

    const userRole = getUserRoleInGroup(groupId);
    if (userRole !== 'admin') {
      throw new Error('Only admins can toggle chat');
    }

    console.log('Toggling chat for group:', { groupId, enabled });
    await update(ref(database, `groups/${groupId}`), {
      chatEnabled: enabled,
      updatedAt: new Date().toISOString(),
    });
  }, [getUserRoleInGroup]);

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!isConfigured || !database) {
      throw new Error('Firebase is not configured');
    }
    
    const group = groups.find(g => g.id === groupId);
    if (group?.adminId === userId) {
      throw new Error('Group admins cannot leave their own group. Please delete the group or transfer ownership first.');
    }
    
    console.log('Leaving group:', groupId);
    
    const membersRef = ref(database, 'members');
    const membersSnapshot = await get(membersRef);
    
    if (membersSnapshot.exists()) {
      const membersData = membersSnapshot.val();
      const memberEntry = Object.entries(membersData).find(
        ([_, memberData]: [string, any]) => 
          memberData.userId === userId && memberData.groupId === groupId
      );
      
      if (memberEntry) {
        const [memberId] = memberEntry;
        await remove(ref(database, `members/${memberId}`));
        console.log('Successfully left group:', groupId);
      }
    }
  }, [userId, groups]);

  return {
    groups,
    isLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupById,
    getMembersByGroupId,
    getUserGroups,
    isGroupAdmin,
    getUserRoleInGroup,
    isGroupCreator,
    promoteMember,
    demoteMember,
    joinGroupWithCode,
    leaveGroup,
    toggleChatEnabled,
  };
});
