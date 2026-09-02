/**
 * Input Validation Schemas (Zod)
 *
 * All user-supplied data is validated before processing.
 * Never trust client-supplied ownership fields.
 */

import { z } from 'zod';
import { config } from '../config';

// ─── Shared ────────────────────────────────────────────────────────────────

export const firestoreIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

export const tagSchema = z
  .string()
  .min(1)
  .max(config.maxTagLength)
  .regex(/^[a-zA-Z0-9 _-]+$/, 'Tag must be alphanumeric');

// ─── Conversation ──────────────────────────────────────────────────────────

export const createConversationSchema = z.object({
  title: z.string().min(1).max(config.maxTitleLength).trim(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(config.maxMessageLength).trim(),
});

// ─── Journal ───────────────────────────────────────────────────────────────

export const createJournalEntrySchema = z.object({
  conversationId: firestoreIdSchema,
  title: z.string().min(1).max(config.maxTitleLength).trim(),
  content: z.string().min(1).max(config.maxJournalContentLength).trim(),
  tags: z.array(tagSchema).max(config.maxTagCount).optional().default([]),
});

export const updateJournalEntrySchema = z.object({
  title: z.string().min(1).max(config.maxTitleLength).trim().optional(),
  content: z.string().min(1).max(config.maxJournalContentLength).trim().optional(),
  tags: z.array(tagSchema).max(config.maxTagCount).optional(),
});

// Type exports
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
