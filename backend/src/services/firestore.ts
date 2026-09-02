/**
 * Firestore Data Access Layer
 *
 * All Firestore operations go through this module.
 * SECURITY: Every query is scoped to the authenticated UID — never trust
 * client-supplied user IDs.
 *
 * Collection structure:
 *   /users/{uid}
 *   /users/{uid}/conversations/{conversationId}
 *   /users/{uid}/conversations/{conversationId}/messages/{messageId}
 *   /users/{uid}/journalEntries/{entryId}
 *   /users/{uid}/integrityLedger/{entryId}
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from './firebaseAdmin';
import {
  Conversation,
  Message,
  JournalEntry,
  IntegrityLedgerEntry,
  ConversationStatus,
  JournalEntryStatus,
} from '../types/models';

// ─── Collection Path Helpers ──────────────────────────────────────────────────

function userDoc(uid: string) {
  return getFirestore().collection('users').doc(uid);
}

function conversationsCol(uid: string) {
  return userDoc(uid).collection('conversations');
}

function conversationDoc(uid: string, conversationId: string) {
  return conversationsCol(uid).doc(conversationId);
}

function messagesCol(uid: string, conversationId: string) {
  return conversationDoc(uid, conversationId).collection('messages');
}

function journalEntriesCol(uid: string) {
  return userDoc(uid).collection('journalEntries');
}

function journalEntryDoc(uid: string, entryId: string) {
  return journalEntriesCol(uid).doc(entryId);
}

function integrityLedgerCol(uid: string) {
  return userDoc(uid).collection('integrityLedger');
}

function integrityLedgerDoc(uid: string, entryId: string) {
  return integrityLedgerCol(uid).doc(entryId);
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function createConversation(
  uid: string,
  data: { title: string },
): Promise<Conversation> {
  const col = conversationsCol(uid);
  const ref = col.doc();
  const now = Timestamp.now();

  const conversation: Conversation = {
    id: ref.id,
    uid,
    title: data.title,
    status: ConversationStatus.ACTIVE,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(conversation);
  return conversation;
}

export async function getConversation(
  uid: string,
  conversationId: string,
): Promise<Conversation | null> {
  const doc = await conversationDoc(uid, conversationId).get();
  if (!doc.exists) return null;
  return doc.data() as Conversation;
}

export async function listConversations(uid: string, limit = 20): Promise<Conversation[]> {
  const snapshot = await conversationsCol(uid)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((d) => d.data() as Conversation);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function addMessage(
  uid: string,
  conversationId: string,
  data: { role: 'user' | 'model'; content: string },
): Promise<Message> {
  const col = messagesCol(uid, conversationId);
  const ref = col.doc();
  const now = Timestamp.now();

  const message: Message = {
    id: ref.id,
    conversationId,
    uid,
    role: data.role,
    content: data.content,
    createdAt: now,
  };

  // Batch: add message + update conversation
  const batch = getFirestore().batch();
  batch.set(ref, message);
  batch.update(conversationDoc(uid, conversationId), {
    messageCount: FieldValue.increment(1),
    updatedAt: now,
  });
  await batch.commit();

  return message;
}

export async function getConversationHistory(
  uid: string,
  conversationId: string,
): Promise<Message[]> {
  const snapshot = await messagesCol(uid, conversationId)
    .orderBy('createdAt', 'asc')
    .get();
  return snapshot.docs.map((d) => d.data() as Message);
}

// ─── Journal Entries ──────────────────────────────────────────────────────────

export async function createJournalEntry(
  uid: string,
  data: {
    conversationId: string;
    title: string;
    content: string;
    tags: string[];
    aiSummary?: string;
  },
): Promise<JournalEntry> {
  const col = journalEntriesCol(uid);
  const ref = col.doc();
  const now = Timestamp.now();

  const entry: JournalEntry = {
    id: ref.id,
    uid,
    conversationId: data.conversationId,
    title: data.title,
    content: data.content,
    tags: data.tags,
    aiSummary: data.aiSummary ?? null,
    status: JournalEntryStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(entry);
  return entry;
}

export async function getJournalEntry(
  uid: string,
  entryId: string,
): Promise<JournalEntry | null> {
  const doc = await journalEntryDoc(uid, entryId).get();
  if (!doc.exists) return null;
  return doc.data() as JournalEntry;
}

export async function listJournalEntries(uid: string, limit = 50): Promise<JournalEntry[]> {
  const snapshot = await journalEntriesCol(uid)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map((d) => d.data() as JournalEntry);
}

export async function updateJournalEntry(
  uid: string,
  entryId: string,
  data: Partial<{ title: string; content: string; tags: string[]; aiSummary: string }>,
): Promise<void> {
  // SECURITY: Can only update DRAFT entries — finalized entries cannot be modified
  const doc = await journalEntryDoc(uid, entryId).get();
  if (!doc.exists) throw new Error('Journal entry not found');

  const entry = doc.data() as JournalEntry;
  if (entry.status !== JournalEntryStatus.DRAFT) {
    throw new Error('Cannot modify a finalized journal entry');
  }

  await journalEntryDoc(uid, entryId).update({
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// ─── Integrity Ledger ─────────────────────────────────────────────────────────

export async function getLatestIntegrityLedgerEntry(
  uid: string,
): Promise<IntegrityLedgerEntry | null> {
  const snapshot = await integrityLedgerCol(uid)
    .orderBy('sequenceNumber', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as IntegrityLedgerEntry;
}

export async function getIntegrityLedger(uid: string): Promise<IntegrityLedgerEntry[]> {
  const snapshot = await integrityLedgerCol(uid)
    .orderBy('sequenceNumber', 'asc')
    .get();
  return snapshot.docs.map((d) => d.data() as IntegrityLedgerEntry);
}

export async function getIntegrityLedgerEntry(
  uid: string,
  entryId: string,
): Promise<IntegrityLedgerEntry | null> {
  const doc = await integrityLedgerDoc(uid, entryId).get();
  if (!doc.exists) return null;
  return doc.data() as IntegrityLedgerEntry;
}
