export type UserRole = 'admin' | 'viewer';

export type MemberRole = 'admin' | 'viewer';

export interface Group {
  id: string;
  name: string;
  description?: string;
  adminId: string;
  creatorId: string;
  inviteCode: string;
  chatEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  userId: string;
  userName: string;
  groupId: string;
  role: MemberRole;
  joinedAt: string;
}

export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface EventAttachment {
  id: string;
  name: string;
  uri: string;
  type: 'image' | 'document';
}

export interface EventReminder {
  id: string;
  minutes: number;
  enabled: boolean;
}

export interface EventLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface PollOption {
  id: string;
  text: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  votes: Record<string, string>;
}

export interface Event {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  categoryId: string;
  repeatFrequency: RepeatFrequency;
  repeatEndDate?: string;
  attachments: EventAttachment[];
  reminders: EventReminder[];
  location?: EventLocation;
  hasPoll?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpandedEvent extends Event {
  instanceDate: string;
  isRecurring: boolean;
}

export type JoinGroupResult = 
  | { success: true; groupId: string; groupName: string; error?: never }
  | { success: false; error: string; groupId?: never; groupName?: never };

export type ChatVisibility = 'open' | 'admin-only' | 'readonly';

export interface Chat {
  id: string;
  groupId: string;
  name: string;
  createdBy: string;
  visibility: ChatVisibility;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}
