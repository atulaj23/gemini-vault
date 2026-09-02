/**
 * SHA-256 Hashing Utilities
 *
 * Used by the Integrity Vault for content hashing and chain hashing.
 */

import { createHash } from 'crypto';

/**
 * Compute a SHA-256 hex digest of the given string.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Canonicalize journal entry content deterministically.
 *
 * Rules:
 * - Trim leading/trailing whitespace
 * - Normalize line endings to \n
 * - Collapse multiple blank lines to a single blank line
 * - Lowercase the entire string for hashing (hash is case-insensitive to normalisation)
 *
 * Note: the canonical form is only used for hashing — the original content
 * is stored separately for display.
 */
export function canonicalizeContent(content: string): string {
  return content
    .trim()
    .replace(/\r\n/g, '\n')  // normalize line endings
    .replace(/\r/g, '\n')     // handle bare CR
    .replace(/\n{3,}/g, '\n\n'); // collapse excess blank lines
}

/**
 * Compute the content hash for a journal entry.
 * This is the SHA-256 of the canonicalized content.
 */
export function computeContentHash(content: string): string {
  return sha256(canonicalizeContent(content));
}

/**
 * Compute the chain hash for a journal entry.
 *
 * chainHash = SHA256(previousHash + contentHash + uid + sequenceNumber + serverTimestampISO)
 *
 * The server controls all inputs to this function — clients cannot forge it.
 */
export function computeChainHash(params: {
  previousHash: string;
  contentHash: string;
  uid: string;
  sequenceNumber: number;
  serverTimestamp: string; // ISO 8601
}): string {
  const input = [
    params.previousHash,
    params.contentHash,
    params.uid,
    String(params.sequenceNumber),
    params.serverTimestamp,
  ].join('|');
  return sha256(input);
}

export const GENESIS_HASH = 'GENESIS';
