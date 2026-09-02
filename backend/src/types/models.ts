/**
 * Data Models — TypeScript types for Firestore documents
 *
 * These are the canonical shapes of data stored in Firestore.
 * All timestamps are Firestore Timestamps.
 */

import { Timestamp } from 'firebase-admin/firestore';

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum JournalEntryStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
}

// ─── Conversation ──────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  uid: string;
  title: string;
  status: ConversationStatus;
  messageCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Message ───────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  uid: string;
  role: 'user' | 'model';
  content: string;
  createdAt: Timestamp;
}

// ─── Journal Entry ─────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  uid: string;
  conversationId: string;
  title: string;
  content: string;
  tags: string[];
  aiSummary: string | null;
  status: JournalEntryStatus;
  // Set when finalized
  contentHash?: string;
  chainHash?: string;
  finalizedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Integrity Ledger ──────────────────────────────────────────────────────

export interface IntegrityLedgerEntry {
  id: string;
  uid: string;
  entryId: string;
  sequenceNumber: number;
  contentHash: string;
  previousHash: string; // "GENESIS" for the first entry
  chainHash: string;
  serverTimestamp: string; // ISO 8601 — set by server
  finalizedAt: Timestamp;
}

// ─── API Response Types ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  requestId?: string;
}
