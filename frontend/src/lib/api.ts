/**
 * Backend API Client
 * 
 * All backend calls go through this module.
 * SECURITY: The Firebase ID token is always attached — never a client-supplied UID.
 * The Gemini API key NEVER touches this file.
 */

import { auth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL ?? '';

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(res.status, err.error ?? 'Request failed', err.code);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function verifyAuth(): Promise<{ uid: string; authenticated: boolean }> {
  const r = await apiFetch<{ uid: string; authenticated: boolean }>('/api/auth/verify', {
    method: 'POST',
  });
  return r;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  uid: string;
  title: string;
  status: string;
  messageCount: number;
  createdAt: { _seconds: number };
  updatedAt: { _seconds: number };
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: { _seconds: number };
}

export async function listConversations(): Promise<Conversation[]> {
  const r = await apiFetch<{ data: Conversation[] }>('/api/conversations');
  return r.data;
}

export async function createConversation(title: string): Promise<Conversation> {
  const r = await apiFetch<{ data: Conversation }>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  return r.data;
}

export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  const r = await apiFetch<{ data: { conversation: Conversation; messages: Message[] } }>(`/api/conversations/${id}`);
  return r.data;
}

export async function sendMessage(conversationId: string, content: string): Promise<{
  userMessage: Message;
  aiMessage: Message;
}> {
  const r = await apiFetch<{ data: { userMessage: Message; aiMessage: Message } }>(
    `/api/conversations/${conversationId}/messages`,
    { method: 'POST', body: JSON.stringify({ content }) },
  );
  return r.data;
}

// ─── Journal ──────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  uid: string;
  conversationId: string;
  title: string;
  content: string;
  tags: string[];
  aiSummary: string | null;
  status: 'draft' | 'finalized';
  contentHash?: string;
  chainHash?: string;
  finalizedAt?: { _seconds: number };
  createdAt: { _seconds: number };
  updatedAt: { _seconds: number };
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  const r = await apiFetch<{ data: JournalEntry[] }>('/api/journal');
  return r.data;
}

export async function createJournalEntry(data: {
  conversationId: string;
  title: string;
  content: string;
  tags: string[];
}): Promise<JournalEntry> {
  const r = await apiFetch<{ data: JournalEntry }>('/api/journal', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.data;
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  const r = await apiFetch<{ data: JournalEntry }>(`/api/journal/${id}`);
  return r.data;
}

export async function finalizeJournalEntry(id: string): Promise<{
  entry: JournalEntry;
  integrityLedger: IntegrityLedgerEntry;
}> {
  const r = await apiFetch<{ data: { entry: JournalEntry; integrityLedger: IntegrityLedgerEntry } }>(
    `/api/journal/${id}/finalize`,
    { method: 'POST' },
  );
  return r.data;
}

// ─── Integrity ────────────────────────────────────────────────────────────────

export interface IntegrityLedgerEntry {
  id: string;
  entryId: string;
  sequenceNumber: number;
  contentHash: string;
  previousHash: string;
  chainHash: string;
  serverTimestamp: string;
  finalizedAt: { _seconds: number };
}

export interface VerificationResult {
  valid: boolean;
  entriesChecked: number;
  verifiedAt: string;
  latestChainHash: string | null;
  firstInvalidEntry: string | null;
  reason: string | null;
}

export async function getIntegrityLedger(): Promise<IntegrityLedgerEntry[]> {
  const r = await apiFetch<{ data: IntegrityLedgerEntry[] }>('/api/integrity/ledger');
  return r.data;
}

export async function verifyIntegrity(): Promise<VerificationResult> {
  const r = await apiFetch<{ data: VerificationResult }>('/api/integrity/verify', {
    method: 'POST',
  });
  return r.data;
}
