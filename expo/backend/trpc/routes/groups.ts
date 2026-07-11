import * as z from "zod";
import { getDb } from "@/backend/db";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { Group, Member, Event } from "@/types/event";
import { TRPCError } from "@trpc/server";

/**
 * tRPC routes for group management.
 *
 * Uses the Firebase Admin SDK database (via getDb()). The admin database uses
 * `db.ref('path')` with methods like `.set()`, `.get()`, `.update()`,
 * `.remove()`, `.on()` — NOT the standalone `ref()` / `set()` / `get()`
 * functions from the client SDK.
 */

async function generateInviteCode(db: any): Promise<string> {
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const groupsSnap = await db.ref('groups').get();

    if (!groupsSnap.exists()) {
      return code;
    }

    const groups = groupsSnap.val();
    const existingCodes = Object.values(groups).map((g: any) => g.inviteCode);

    if (!existingCodes.includes(code)) {
      return code;
    }
    attempts++;
  }

  throw new Error('Failed to generate unique invite code');
}

async function isInviteCodeAvailable(db: any, code: string, excludeGroupId?: string): Promise<boolean> {
  const groupsSnap = await db.ref('groups').get();

  if (!groupsSnap.exists()) {
    return true;
  }

  const groups = groupsSnap.val();
  const matchingGroups = Object.entries(groups).filter(
    ([_id, data]: [string, any]) => data.inviteCode === code
  );

  if (matchingGroups.length === 0) {
    return true;
  }

  if (excludeGroupId) {
    return matchingGroups.length === 1 && matchingGroups[0][0] === excludeGroupId;
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

      const inviteCode = await generateInviteCode(db);
      const now = new Date().toISOString();

      const group: Group = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: input.name,
        description: input.description,
        adminId: input.adminId,
        creatorId: input.adminId,
        inviteCode,
        chatEnabled: false,
        createdAt: now,
        updatedAt: now,
      };

      await db.ref(`groups/${group.id}`).set(group);

      const member: Member = {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: input.adminId,
        userName: input.userName,
        groupId: group.id,
        role: "admin",
        joinedAt: now,
      };

      await db.ref(`members/${member.id}`).set(member);

      console.log('Group created in Firebase:', group);
      return group;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const snapshot = await db.ref(`groups/${input.id}`).get();
      return snapshot.exists() ? (snapshot.val() as Group) : null;
    }),

  getByInviteCode: publicProcedure
    .input(z.object({ inviteCode: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const groupsSnap = await db.ref('groups').get();

      if (groupsSnap.exists()) {
        const groups = groupsSnap.val();
        const found = Object.entries(groups).find(
          ([_id, data]: [string, any]) => data.inviteCode === input.inviteCode
        );
        if (found) {
          return found[1] as Group;
        }
      }

      return null;
    }),

  getUserGroups: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const membersSnap = await db.ref('members').get();

      if (!membersSnap.exists()) {
        return [];
      }

      const members = membersSnap.val();
      const memberArray: Member[] = Object.values(members);
      const userMembers = memberArray.filter((m) => m.userId === input.userId);

      if (userMembers.length === 0) {
        return [];
      }

      const groups: Group[] = [];

      for (const member of userMembers) {
        const groupSnapshot = await db.ref(`groups/${member.groupId}`).get();
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

      await db.ref(`groups/${input.id}`).update(updates);

      const snapshot = await db.ref(`groups/${input.id}`).get();
      console.log('Group updated:', snapshot.val());
      return snapshot.val() as Group;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const membersSnap = await db.ref('members').get();

      if (membersSnap.exists()) {
        const members = membersSnap.val();
        for (const [memberId, memberData] of Object.entries(members)) {
          if ((memberData as any).groupId === input.id) {
            await db.ref(`members/${memberId}`).remove();
          }
        }
      }

      const eventsSnap = await db.ref('events').get();

      if (eventsSnap.exists()) {
        const events = eventsSnap.val();
        for (const [eventId, eventData] of Object.entries(events)) {
          if ((eventData as any).groupId === input.id) {
            await db.ref(`events/${eventId}`).remove();
          }
        }
      }

      await db.ref(`groups/${input.id}`).remove();

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

      const groupsSnap = await db.ref('groups').get();

      if (!groupsSnap.exists()) {
        console.log('No groups found');
        return { success: false, error: "Group not found" };
      }

      const groups = groupsSnap.val();
      const found = Object.entries(groups).find(
        ([_id, data]: [string, any]) => data.inviteCode === input.inviteCode
      );

      if (!found) {
        console.log('No group found with code:', input.inviteCode);
        return { success: false, error: "Group not found" };
      }

      const group = found[1] as Group;

      console.log('Found group:', group);

      const membersSnap = await db.ref('members').get();

      if (membersSnap.exists()) {
        const members = membersSnap.val();
        const existingMember = Object.values(members).find(
          (m: any) => m.groupId === group.id && m.userId === input.userId
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

      await db.ref(`members/${member.id}`).set(member);

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
      const membersSnap = await db.ref('members').get();

      if (!membersSnap.exists()) {
        return [];
      }

      const members = membersSnap.val();
      return Object.values(members).filter(
        (m: any) => m.groupId === input.groupId
      ) as Member[];
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
        await db.ref(`events/${eventId}`).set(eventData);
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
      const eventsSnap = await db.ref('events').get();

      if (!eventsSnap.exists()) {
        return [];
      }

      const events = eventsSnap.val();
      return Object.values(events).filter(
        (e: any) => e.groupId === input.groupId
      ) as Event[];
    }),

  getAllUserEvents: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();

      const membersSnap = await db.ref('members').get();

      if (!membersSnap.exists()) {
        return [];
      }

      const members = membersSnap.val();
      const memberArray: Member[] = Object.values(members);
      const userMembers = memberArray.filter((m) => m.userId === input.userId);
      const groupIds = userMembers.map((m) => m.groupId);

      const eventsSnap = await db.ref('events').get();

      if (!eventsSnap.exists()) {
        return [];
      }

      const allEvents = eventsSnap.val();
      const events: Event[] = Object.values(allEvents);

      return events.filter((event) => groupIds.includes(event.groupId || ''));
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

      await db.ref(`events/${input.id}`).update(updates);

      const snapshot = await db.ref(`events/${input.id}`).get();
      return snapshot.val() as Event;
    }),

  deleteEvent: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.ref(`events/${input.id}`).remove();
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

      const groupSnapshot = await db.ref(`groups/${input.groupId}`).get();
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

      const membersSnap = await db.ref('members').get();

      if (membersSnap.exists()) {
        const members = membersSnap.val();
        const memberEntry = Object.entries(members).find(
          ([_id, memberData]: [string, any]) =>
            memberData.groupId === input.groupId && memberData.userId === input.userId
        );

        if (memberEntry) {
          const [memberId] = memberEntry;
          await db.ref(`members/${memberId}`).remove();
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

      const groupSnapshot = await db.ref(`groups/${input.groupId}`).get();
      if (!groupSnapshot.exists()) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      const membersSnap = await db.ref('members').get();

      let isRequestingUserAdmin = false;
      if (membersSnap.exists()) {
        const members = membersSnap.val();
        const requestingMember = Object.values(members).find(
          (m: any) => m.groupId === input.groupId && m.userId === input.requestingUserId
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

      const memberSnapshot = await db.ref(`members/${input.memberId}`).get();
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

      await db.ref(`members/${input.memberId}`).update({ role: 'admin' });
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

      const groupSnapshot = await db.ref(`groups/${input.groupId}`).get();
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

      const memberSnapshot = await db.ref(`members/${input.memberId}`).get();
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

      await db.ref(`members/${input.memberId}`).update({ role: 'viewer' });
      console.log('Member demoted to viewer:', { memberId: input.memberId, groupId: input.groupId });
      return { success: true };
    }),
});
