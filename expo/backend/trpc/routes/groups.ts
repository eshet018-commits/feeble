import * as z from "zod";
import { ref, set, get, update, remove, query, orderByChild, equalTo } from "firebase/database";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { Group, Member, Event } from "@/types/event";
import { TRPCError } from "@trpc/server";

async function generateInviteCode(): Promise<string> {
  const db = getDb();
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const groupsRef = ref(db, 'groups');
    const q = query(groupsRef, orderByChild('inviteCode'), equalTo(code));
    const snapshot = await get(q);
    
    if (!snapshot.exists()) {
      isUnique = true;
      return code;
    }
    attempts++;
  }

  throw new Error('Failed to generate unique invite code');
}

async function isInviteCodeAvailable(code: string, excludeGroupId?: string): Promise<boolean> {
  const db = getDb();
  const groupsRef = ref(db, 'groups');
  const q = query(groupsRef, orderByChild('inviteCode'), equalTo(code));
  const snapshot = await get(q);
  
  if (!snapshot.exists()) {
    return true;
  }

  if (excludeGroupId) {
    const groups = snapshot.val();
    const matchingGroupIds = Object.keys(groups);
    return matchingGroupIds.length === 1 && matchingGroupIds[0] === excludeGroupId;
  }

  return false;
}

export const groupsRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        adminId: z.string(),
        userName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const inviteCode = await generateInviteCode();
      const now = new Date().toISOString();
      
      const group: Group = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: input.name,
        description: input.description,
        adminId: input.adminId,
        creatorId: input.adminId,
        inviteCode,
        createdAt: now,
        updatedAt: now,
      };

      await set(ref(db, `groups/${group.id}`), group);

      const member: Member = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: input.adminId,
        userName: input.userName,
        groupId: group.id,
        role: "admin",
        joinedAt: now,
      };

      await set(ref(db, `members/${member.id}`), member);

      console.log('Group created in Firebase:', group);
      return group;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const snapshot = await get(ref(db, `groups/${input.id}`));
      return snapshot.exists() ? (snapshot.val() as Group) : null;
    }),

  getByInviteCode: publicProcedure
    .input(z.object({ inviteCode: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const groupsRef = ref(db, 'groups');
      const q = query(groupsRef, orderByChild('inviteCode'), equalTo(input.inviteCode));
      const snapshot = await get(q);
      
      if (snapshot.exists()) {
        const groups = snapshot.val();
        const groupId = Object.keys(groups)[0];
        return groups[groupId] as Group;
      }
      
      return null;
    }),

  getUserGroups: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      
      const membersRef = ref(db, 'members');
      const q = query(membersRef, orderByChild('userId'), equalTo(input.userId));
      const snapshot = await get(q);
      
      if (!snapshot.exists()) {
        return [];
      }

      const members = snapshot.val();
      const memberArray: Member[] = Object.values(members);
      
      if (memberArray.length === 0) {
        return [];
      }

      const groups: Group[] = [];
      
      for (const member of memberArray) {
        const groupSnapshot = await get(ref(db, `groups/${member.groupId}`));
        if (groupSnapshot.exists()) {
          groups.push(groupSnapshot.val() as Group);
        }
      }
      
      console.log('User groups fetched:', groups);
      return groups;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        inviteCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      if (input.inviteCode) {
        const isAvailable = await isInviteCodeAvailable(input.inviteCode, input.id);
        if (!isAvailable) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This invite code is already in use by another group',
          });
        }
      }

      const updates: Partial<Group> = {
        updatedAt: new Date().toISOString(),
      };
      
      if (input.name) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.inviteCode) updates.inviteCode = input.inviteCode;

      await update(ref(db, `groups/${input.id}`), updates);
      
      const snapshot = await get(ref(db, `groups/${input.id}`));
      console.log('Group updated:', snapshot.val());
      return snapshot.val() as Group;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const membersRef = ref(db, 'members');
      const q = query(membersRef, orderByChild('groupId'), equalTo(input.id));
      const membersSnapshot = await get(q);
      
      if (membersSnapshot.exists()) {
        const members = membersSnapshot.val();
        for (const memberId of Object.keys(members)) {
          await remove(ref(db, `members/${memberId}`));
        }
      }
      
      const eventsRef = ref(db, 'events');
      const eventsQuery = query(eventsRef, orderByChild('groupId'), equalTo(input.id));
      const eventsSnapshot = await get(eventsQuery);
      
      if (eventsSnapshot.exists()) {
        const events = eventsSnapshot.val();
        for (const eventId of Object.keys(events)) {
          await remove(ref(db, `events/${eventId}`));
        }
      }
      
      await remove(ref(db, `groups/${input.id}`));
      
      console.log('Group deleted:', input.id);
      return { success: true };
    }),

  joinWithCode: publicProcedure
    .input(
      z.object({
        inviteCode: z.string(),
        userId: z.string(),
        userName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      console.log('Searching for group with code:', input.inviteCode);
      
      const groupsRef = ref(db, 'groups');
      const q = query(groupsRef, orderByChild('inviteCode'), equalTo(input.inviteCode));
      const snapshot = await get(q);

      if (!snapshot.exists()) {
        console.log('No group found with code:', input.inviteCode);
        return { success: false, error: "Group not found" };
      }

      const groups = snapshot.val();
      const groupId = Object.keys(groups)[0];
      const group = groups[groupId] as Group;
      
      console.log('Found group:', group);

      const membersRef = ref(db, 'members');
      const membersQuery = query(membersRef, orderByChild('userId'), equalTo(input.userId));
      const membersSnapshot = await get(membersQuery);

      if (membersSnapshot.exists()) {
        const members = membersSnapshot.val();
        const existingMember = Object.values(members).find(
          (m: any) => m.groupId === group.id
        );
        
        if (existingMember) {
          console.log('User already member of group');
          return { success: false, error: "You are already a member of this group" };
        }
      }

      const member: Member = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: input.userId,
        userName: input.userName,
        groupId: group.id,
        role: "viewer",
        joinedAt: new Date().toISOString(),
      };

      await set(ref(db, `members/${member.id}`), member);

      console.log('User joined group:', { groupId: group.id, groupName: group.name });
      return {
        success: true,
        groupId: group.id,
        groupName: group.name,
      };
    }),

  getMembers: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const membersRef = ref(db, 'members');
      const q = query(membersRef, orderByChild('groupId'), equalTo(input.groupId));
      const snapshot = await get(q);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const members = snapshot.val();
      return Object.values(members) as Member[];
    }),

  createEvent: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        allDay: z.boolean(),
        categoryId: z.string(),
        repeatFrequency: z.enum(['none', 'daily', 'weekly', 'monthly']),
        repeatEndDate: z.string().optional(),
        reminders: z.array(z.object({
          id: z.string(),
          minutes: z.number(),
          enabled: z.boolean(),
        })),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('Creating event - Start');
      let db;
      try {
        db = getDb();
        console.log('Database retrieved successfully');
      } catch (dbError: any) {
        console.error('Database configuration error:', dbError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not configured. Please check Firebase settings.',
        });
      }

      try {
        const now = new Date().toISOString();
        const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log('Creating event with ID:', eventId);
        
        const eventData: any = {
          id: eventId,
          groupId: input.groupId,
          title: input.title,
          startDate: input.startDate,
          endDate: input.endDate,
          allDay: input.allDay,
          categoryId: input.categoryId,
          repeatFrequency: input.repeatFrequency,
          attachments: [],
          reminders: input.reminders,
          createdAt: now,
          updatedAt: now,
        };

        if (input.description) {
          eventData.description = input.description;
        }
        
        if (input.repeatEndDate) {
          eventData.repeatEndDate = input.repeatEndDate;
        }

        console.log('Writing to Firebase...');
        await set(ref(db, `events/${eventId}`), eventData);
        console.log('Event created in Firebase:', eventId);
        
        return {
          id: eventId,
          success: true,
        };
      } catch (error: any) {
        console.error('Error creating event:', error);
        console.error('Error stack:', error?.stack);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create event: ${error.message || 'Unknown error'}`,
        });
      }
    }),

  getGroupEvents: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const eventsRef = ref(db, 'events');
      const q = query(eventsRef, orderByChild('groupId'), equalTo(input.groupId));
      const snapshot = await get(q);
      
      if (!snapshot.exists()) {
        return [];
      }
      
      const events = snapshot.val();
      return Object.values(events) as Event[];
    }),

  getAllUserEvents: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      
      const membersRef = ref(db, 'members');
      const membersQuery = query(membersRef, orderByChild('userId'), equalTo(input.userId));
      const membersSnapshot = await get(membersQuery);
      
      if (!membersSnapshot.exists()) {
        return [];
      }

      const members = membersSnapshot.val();
      const memberArray: Member[] = Object.values(members);
      const groupIds = memberArray.map(m => m.groupId);
      
      const eventsRef = ref(db, 'events');
      const eventsSnapshot = await get(eventsRef);
      
      if (!eventsSnapshot.exists()) {
        return [];
      }

      const allEvents = eventsSnapshot.val();
      const events: Event[] = Object.values(allEvents);
      
      return events.filter(event => groupIds.includes(event.groupId || ''));
    }),

  updateEvent: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        allDay: z.boolean().optional(),
        categoryId: z.string().optional(),
        repeatFrequency: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
        repeatEndDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const updates: Partial<Event> = {
        updatedAt: new Date().toISOString(),
      };
      
      if (input.title) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.startDate) updates.startDate = input.startDate;
      if (input.endDate) updates.endDate = input.endDate;
      if (input.allDay !== undefined) updates.allDay = input.allDay;
      if (input.categoryId) updates.categoryId = input.categoryId;
      if (input.repeatFrequency) updates.repeatFrequency = input.repeatFrequency;
      if (input.repeatEndDate !== undefined) updates.repeatEndDate = input.repeatEndDate;

      await update(ref(db, `events/${input.id}`), updates);
      
      const snapshot = await get(ref(db, `events/${input.id}`));
      return snapshot.val() as Event;
    }),

  deleteEvent: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await remove(ref(db, `events/${input.id}`));
      console.log('Event deleted:', input.id);
      return { success: true };
    }),

  leaveGroup: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const groupSnapshot = await get(ref(db, `groups/${input.groupId}`));
      if (!groupSnapshot.exists()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }
      
      const group = groupSnapshot.val() as Group;
      if (group.adminId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Group admins cannot leave their own group. Please delete the group or transfer ownership first.',
        });
      }
      
      const membersRef = ref(db, 'members');
      const q = query(membersRef, orderByChild('userId'), equalTo(input.userId));
      const membersSnapshot = await get(q);
      
      if (membersSnapshot.exists()) {
        const members = membersSnapshot.val();
        const memberEntry = Object.entries(members).find(
          ([_, memberData]: [string, any]) => memberData.groupId === input.groupId
        );
        
        if (memberEntry) {
          const [memberId] = memberEntry;
          await remove(ref(db, `members/${memberId}`));
          console.log('User left group:', { userId: input.userId, groupId: input.groupId });
          return { success: true };
        }
      }
      
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found in group',
      });
    }),

  promoteMember: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        memberId: z.string(),
        requestingUserId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const groupSnapshot = await get(ref(db, `groups/${input.groupId}`));
      if (!groupSnapshot.exists()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }
      
      const membersRef = ref(db, 'members');
      const requestingMemberQuery = query(membersRef, orderByChild('userId'), equalTo(input.requestingUserId));
      const requestingMemberSnapshot = await get(requestingMemberQuery);
      
      let isRequestingUserAdmin = false;
      if (requestingMemberSnapshot.exists()) {
        const members = requestingMemberSnapshot.val();
        const requestingMember = Object.values(members).find(
          (m: any) => m.groupId === input.groupId
        ) as Member | undefined;
        
        if (requestingMember) {
          isRequestingUserAdmin = requestingMember.role === 'admin';
        }
      }
      
      if (!isRequestingUserAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can promote members',
        });
      }
      
      const memberSnapshot = await get(ref(db, `members/${input.memberId}`));
      if (!memberSnapshot.exists()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }
      
      const member = memberSnapshot.val() as Member;
      if (member.groupId !== input.groupId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Member does not belong to this group',
        });
      }
      
      if (member.role === 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Member is already an admin',
        });
      }
      
      await update(ref(db, `members/${input.memberId}`), { role: 'admin' });
      console.log('Member promoted to admin:', { memberId: input.memberId, groupId: input.groupId });
      return { success: true };
    }),

  demoteMember: publicProcedure
    .input(
      z.object({
        groupId: z.string(),
        memberId: z.string(),
        requestingUserId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const groupSnapshot = await get(ref(db, `groups/${input.groupId}`));
      if (!groupSnapshot.exists()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }
      
      const group = groupSnapshot.val() as Group;
      
      if (group.creatorId !== input.requestingUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the group creator can demote admins',
        });
      }
      
      const memberSnapshot = await get(ref(db, `members/${input.memberId}`));
      if (!memberSnapshot.exists()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }
      
      const member = memberSnapshot.val() as Member;
      if (member.groupId !== input.groupId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Member does not belong to this group',
        });
      }
      
      if (member.userId === group.creatorId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot demote the group creator',
        });
      }
      
      if (member.role === 'viewer') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Member is already a viewer',
        });
      }
      
      await update(ref(db, `members/${input.memberId}`), { role: 'viewer' });
      console.log('Member demoted to viewer:', { memberId: input.memberId, groupId: input.groupId });
      return { success: true };
    }),
});
