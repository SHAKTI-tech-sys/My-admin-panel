import { Timestamp } from 'firebase/firestore';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  photoURL: string;
  email: string;
  messengerId?: string;
  bio?: string;
  publicKey?: string;
  password?: string;
  status: 'online' | 'offline';
  lastSeen?: Timestamp;
  isVerified?: boolean;
  offlyId?: string; // Same as messengerId 
  language?: string;
  settings?: {
    readReceipts: boolean;
    typingIndicators: boolean;
    pushNotifications: boolean;
    lastSeenVisible?: boolean;
    profilePhotoVisible?: boolean;
    statusVisible?: boolean;
    theme?: 'light' | 'dark' | 'system';
    fontSize?: 'small' | 'medium' | 'large';
    autoDownload?: boolean;
    twoStepVerification?: boolean;
  };
}

export function isUserOnline(profile?: UserProfile): boolean {
  if (!profile) return false;
  if (!profile.lastSeen) return profile.status === 'online';
  
  // A user is online if status is 'online' AND lastSeen was within the last 3 minutes
  const lastSeenMs = (profile.lastSeen as any).toMillis?.() || (profile.lastSeen as any).seconds * 1000 || 0;
  const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
  
  return profile.status === 'online' && lastSeenMs > threeMinutesAgo;
}

export interface Chat {
  id: string;
  participants: string[]; // Messenger IDs (6 digits)
  participantUids: string[]; // Firebase Auth UIDs
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  updatedAt: Timestamp;
  typingStatus?: Record<string, boolean>; // messengerId -> isTyping
  unreadCount?: Record<string, number>; // messengerId -> count
  hiddenFor?: string[]; // Array of messengerIds who have "deleted" this chat
  isGroup?: boolean;
  groupName?: string;
  groupPhoto?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  clearedAt?: Record<string, Timestamp>; // messengerId -> time when chat was cleared
}

export interface SavedContact {
  id: string;
  savedByUserId: string; // current messengerId
  savedByUid: string;
  linkedUserId: string; // target messengerId
  customName: string;
  offlyId: string;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId?: string; // Explicit receiver for individual chats
  timestamp: Timestamp;
  type: MessageType;
  mediaUrl?: string; // For images/videos
  deleted?: boolean;
  isEncrypted?: boolean;
  reactions?: Record<string, string[]>; // emoji -> array of messengerIds
  statusReply?: {
    mediaUrl: string;
    type: 'image' | 'video';
    caption?: string;
  };
  selfDestruct?: boolean;
  status?: 'sent' | 'delivered' | 'seen'; // WhatsApp-style status
  sentStatus?: boolean;
  deliveredStatus?: boolean;
  seenStatus?: boolean;
  seenAt?: Timestamp;
  deliveredAt?: Timestamp;
}

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  REQUESTING = 'requesting',
  RINGING = 'ringing',
  ONGOING = 'ongoing',
  ENDED = 'ended',
  REJECTED = 'rejected',
  MISSED = 'missed',
}

export interface CallSession {
  id: string;
  callerId: string; // messengerId
  callerUid: string; // Firebase Auth UID
  receiverId: string; // messengerId
  receiverUid: string; // Firebase Auth UID
  callerName: string;
  callerPhotoURL?: string;
  type: CallType;
  status: CallStatus;
  timestamp: Timestamp;
  participantsUids?: string[]; // Array of unique UIDs for all devices involved
  signalData?: string; // JSON string of WebRTC signal
  answerData?: string; // JSON string of WebRTC answer
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface StatusUpdate {
  id: string;
  creatorId: string;
  creatorUid: string;
  creatorName: string;
  creatorPhotoURL?: string;
  mediaUrl: string;
  type: 'image' | 'video';
  caption?: string;
  timestamp: Timestamp;
  viewers: string[]; // messengerIds
}

export enum AppScreen {
  CHATS = 'chats',
  STATUS = 'status',
  CONNECTION = 'connection',
  CALLS = 'calls',
  SETTINGS = 'settings',
  PLANS = 'plans',
  DELETE_ACCOUNT = 'delete_account',
  ABOUT = 'about',
  ADMIN = 'admin',
  NEW_MESSAGE = 'new_message',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}
