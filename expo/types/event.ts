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

/**
 * Per-chat, per-user settings stored locally on the device.
 */
export interface ChatSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showTimestamps: boolean;
  showSenderNames: boolean;
  enterToSend: boolean;
}

export interface Chat {
  id: string;
  groupId: string;
  name: string;
  createdBy: string;
  visibility: ChatVisibility;
  createdAt: string;
}

export interface ChatFileAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface ChatReplyInfo {
  messageId: string;
  userName: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  attachment?: ChatFileAttachment;
  replyTo?: ChatReplyInfo;
}

/**
 * Predefined visibility durations for an announcement (in hours).
 * `0` means the announcement never auto-expires.
 */
export type AnnouncementDuration = 0 | 6 | 24 | 72 | 168 | 720;

export interface Announcement {
  id: string;
  groupId: string;
  title: string;
  body: string;
  createdBy: string;
  createdByName: string;
  /** ISO timestamp the announcement was created. */
  createdAt: string;
  /** Visibility duration in hours. `0` = never expires. */
  durationHours: AnnouncementDuration;
  /** ISO timestamp when the announcement should auto-hide. Undefined when it never expires. */
  expiresAt?: string;
}
