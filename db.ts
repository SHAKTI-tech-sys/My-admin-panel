import Dexie, { Table } from 'dexie';
import { Message, Chat, UserProfile } from '../types';

export class OfflyDB extends Dexie {
  messages!: Table<Message>;
  chats!: Table<Chat>;
  profiles!: Table<UserProfile>;

  constructor() {
    super('OfflyDB');
    this.version(1).stores({
      messages: 'id, senderId, timestamp, chatId', // chats are organized by collections in Firestore, but simplified here
      chats: 'id, updatedAt',
      profiles: 'messengerId, uid'
    });
  }
}

export const db = new OfflyDB();
