/**
 * Integrity Vault Service
 *
 * Implements the SHA-256 hash chain for tamper-evident journal entries.
 *
 * SECURITY:
 * - The server controls all chain inputs (previousHash, sequence, timestamp)
 * - Firestore transactions prevent concurrent chain forks
 * - Clients cannot modify finalized integrity metadata
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getFirestore } from './firebaseAdmin';
import { computeContentHash, computeChainHash, GENESIS_HASH } from '../utils/crypto';
import { JournalEntry, IntegrityLedgerEntry, JournalEntryStatus } from '../types/models';
import { NotFoundError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Finalize a journal entry and add it to the integrity chain.
 *
 * Uses a Firestore transaction to:
 * 1. Verify the entry exists and belongs to the user
 * 2. Verify it hasn't already been finalized
 * 3. Read the current chain tail atomically
 * 4. Compute content hash and chain hash
 * 5. Write the integrity ledger entry and update the journal entry — atomically
 *
 * The transaction prevents two concurrent finalizations from forking the chain.
 */
export async function finalizeJournalEntry(
  uid: string,
  entryId: string,
): Promise<{ entry: JournalEntry; ledger: IntegrityLedgerEntry }> {
  const db = getFirestore();

  return await db.runTransaction(async (tx) => {
    // ── 1. Load the journal entry ──────────────────────────────────────────
    const entryRef = db
      .collection('users').doc(uid)
      .collection('journalEntries').doc(entryId);

    const entrySnap = await tx.get(entryRef);
    if (!entrySnap.exists) {
      throw new NotFoundError('Journal entry not found');
    }

    const entry = entrySnap.data() as JournalEntry;

    // SECURITY: Verify ownership (extra safety — path already scoped to uid)
    if (entry.uid !== uid) {
      throw new NotFoundError('Journal entry not found');
    }

    if (entry.status === JournalEntryStatus.FINALIZED) {
      throw new ConflictError('Journal entry is already finalized');
    }

    // ── 2. Get the current chain tail (atomically, inside transaction) ─────
    const ledgerRef = db.collection('users').doc(uid).collection('integrityLedger');
    const latestSnapshot = await tx.get(
      ledgerRef.orderBy('sequenceNumber', 'desc').limit(1)
    );

    let previousHash: string;
    let sequenceNumber: number;

    if (latestSnapshot.empty) {
      previousHash = GENESIS_HASH;
      sequenceNumber = 1;
    } else {
      const latest = latestSnapshot.docs[0].data() as IntegrityLedgerEntry;
      previousHash = latest.chainHash;
      sequenceNumber = latest.sequenceNumber + 1;
    }

    // ── 3. Compute hashes ─────────────────────────────────────────────────
    const serverTimestamp = new Date().toISOString();
    const contentHash = computeContentHash(entry.content);
    const chainHash = computeChainHash({
      previousHash,
      contentHash,
      uid,
      sequenceNumber,
      serverTimestamp,
    });

    // ── 4. Write integrity ledger entry ────────────────────────────────────
    const ledgerDocRef = ledgerRef.doc(entryId);
    const ledgerEntry: IntegrityLedgerEntry = {
      id: entryId,
      uid,
      entryId,
      sequenceNumber,
      contentHash,
      previousHash,
      chainHash,
      serverTimestamp,
      finalizedAt: Timestamp.now(),
    };

    tx.set(ledgerDocRef, ledgerEntry);

    // ── 5. Update journal entry status to FINALIZED ────────────────────────
    tx.update(entryRef, {
      status: JournalEntryStatus.FINALIZED,
      contentHash,
      chainHash,
      finalizedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logger.info('Journal entry finalized', {
      uid,
      entryId,
      sequenceNumber,
      // SECURITY: Never log content, hashes are fine (public cryptographic values)
      chainHashPrefix: chainHash.substring(0, 16) + '...',
    });

    return {
      entry: {
        ...entry,
        status: JournalEntryStatus.FINALIZED,
        contentHash,
        chainHash,
      },
      ledger: ledgerEntry,
    };
  });
}

/**
 * Verify the integrity of the entire hash chain for a user.
 *
 * Algorithm:
 * 1. Load all finalized entries in sequence order
 * 2. For each entry:
 *    a. Recompute contentHash from stored content
 *    b. Verify contentHash matches stored value
 *    c. Recompute chainHash
 *    d. Verify chainHash matches stored value
 *    e. Verify previousHash links correctly to previous entry
 * 3. Return structured verification result
 */
export async function verifyIntegrityChain(uid: string): Promise<VerificationResult> {
  const db = getFirestore();
  const verifiedAt = new Date().toISOString();

  // Load all ledger entries in sequence order
  const ledgerSnapshot = await db
    .collection('users').doc(uid)
    .collection('integrityLedger')
    .orderBy('sequenceNumber', 'asc')
    .get();

  if (ledgerSnapshot.empty) {
    return {
      valid: true,
      entriesChecked: 0,
      verifiedAt,
      latestChainHash: null,
      firstInvalidEntry: null,
      reason: null,
    };
  }

  const ledgerEntries = ledgerSnapshot.docs.map((d) => d.data() as IntegrityLedgerEntry);

  let previousChainHash: string = GENESIS_HASH;
  let entriesChecked = 0;

  for (const ledgerEntry of ledgerEntries) {
    entriesChecked++;

    // Load the corresponding journal entry to re-verify content hash
    const entrySnap = await db
      .collection('users').doc(uid)
      .collection('journalEntries').doc(ledgerEntry.entryId)
      .get();

    if (!entrySnap.exists) {
      return {
        valid: false,
        entriesChecked,
        verifiedAt,
        latestChainHash: entriesChecked > 1 ? ledgerEntries[entriesChecked - 2].chainHash : null,
        firstInvalidEntry: ledgerEntry.entryId,
        reason: 'ENTRY_MISSING',
      };
    }

    const journalEntry = entrySnap.data() as JournalEntry;

    // Recompute content hash
    const recomputedContentHash = computeContentHash(journalEntry.content);
    if (recomputedContentHash !== ledgerEntry.contentHash) {
      return {
        valid: false,
        entriesChecked,
        verifiedAt,
        latestChainHash: entriesChecked > 1 ? ledgerEntries[entriesChecked - 2].chainHash : null,
        firstInvalidEntry: ledgerEntry.entryId,
        reason: 'CONTENT_HASH_MISMATCH',
      };
    }

    // Verify previous hash linkage
    if (ledgerEntry.previousHash !== previousChainHash) {
      return {
        valid: false,
        entriesChecked,
        verifiedAt,
        latestChainHash: entriesChecked > 1 ? ledgerEntries[entriesChecked - 2].chainHash : null,
        firstInvalidEntry: ledgerEntry.entryId,
        reason: 'PREVIOUS_HASH_MISMATCH',
      };
    }

    // Recompute chain hash
    const recomputedChainHash = computeChainHash({
      previousHash: ledgerEntry.previousHash,
      contentHash: ledgerEntry.contentHash,
      uid,
      sequenceNumber: ledgerEntry.sequenceNumber,
      serverTimestamp: ledgerEntry.serverTimestamp,
    });

    if (recomputedChainHash !== ledgerEntry.chainHash) {
      return {
        valid: false,
        entriesChecked,
        verifiedAt,
        latestChainHash: entriesChecked > 1 ? ledgerEntries[entriesChecked - 2].chainHash : null,
        firstInvalidEntry: ledgerEntry.entryId,
        reason: 'CHAIN_HASH_MISMATCH',
      };
    }

    previousChainHash = ledgerEntry.chainHash;
  }

  return {
    valid: true,
    entriesChecked,
    verifiedAt,
    latestChainHash: ledgerEntries[ledgerEntries.length - 1].chainHash,
    firstInvalidEntry: null,
    reason: null,
  };
}

export interface VerificationResult {
  valid: boolean;
  entriesChecked: number;
  verifiedAt: string;
  latestChainHash: string | null;
  firstInvalidEntry: string | null;
  reason: string | null;
}

// Re-export for use in routes
export { getLatestIntegrityLedgerEntry, getIntegrityLedger } from './firestore';
