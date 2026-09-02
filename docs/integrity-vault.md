# Integrity Vault — Technical Deep Dive

## What is it?

The Integrity Vault is a server-controlled SHA-256 hash chain that makes finalized journal entries **tamper-evident**.

This is **not blockchain**. This is **not absolute immutability**. This is **tamper-evidence**: if content stored in Firestore is modified after finalization, the verification process will detect the broken link.

---

## Hash Chain Algorithm

### Step 1: Canonicalize Content

Before hashing, the content is canonicalized to normalize cosmetic differences:

```
canonicalize(content):
  1. Trim leading/trailing whitespace
  2. Normalize line endings to \n
  3. Collapse 3+ blank lines to 2
```

This ensures that saving an entry from different operating systems doesn't produce different hashes.

### Step 2: Content Hash

```
contentHash = SHA256(canonicalize(content))
```

This is the fingerprint of the entry's content. If a single byte changes, the hash changes.

### Step 3: Chain Hash

```
chainHash = SHA256(
  previousHash  +  "|"  +
  contentHash   +  "|"  +
  uid           +  "|"  +
  sequenceNumber + "|"  +
  serverTimestamp
)
```

For the first entry:
```
previousHash = "GENESIS"
```

For every subsequent entry:
```
previousHash = chainHash of the previous entry
```

### Step 4: Transactional Finalization

The entire finalization operation runs inside a Firestore transaction:

1. Load the journal entry (verify it's a draft owned by this user)
2. Query the current chain tail (atomically, within the transaction)
3. Compute `contentHash` and `chainHash`
4. Write the integrity ledger entry
5. Update the journal entry status to `finalized`

The transaction prevents two concurrent finalization requests from forking the chain.

---

## Verification Algorithm

When the user clicks "Verify Entire Journal":

1. Load all integrity ledger entries in `sequenceNumber` order
2. For each entry:
   a. Load the corresponding journal entry from Firestore
   b. Recompute `contentHash` from the stored content
   c. Compare against stored `contentHash` → detect `CONTENT_HASH_MISMATCH`
   d. Verify `previousHash` matches the previous entry's `chainHash` → detect `PREVIOUS_HASH_MISMATCH`
   e. Recompute `chainHash` with all inputs → detect `CHAIN_HASH_MISMATCH`
3. Return a structured result

### Success Example

```json
{
  "valid": true,
  "entriesChecked": 24,
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "latestChainHash": "a3f8c2d1e4b5f6...",
  "firstInvalidEntry": null,
  "reason": null
}
```

### Failure Example

```json
{
  "valid": false,
  "entriesChecked": 14,
  "verifiedAt": "2024-01-15T10:30:00.000Z",
  "latestChainHash": null,
  "firstInvalidEntry": "entry_014",
  "reason": "CONTENT_HASH_MISMATCH"
}
```

---

## Security Properties

| Property | How it's enforced |
|---|---|
| Client cannot forge chain | Server controls `previousHash`, `sequenceNumber`, `serverTimestamp` |
| Client cannot skip entries | Sequence numbers are server-assigned and verified |
| Client cannot modify finalized entries | Firestore rules block client writes to `integrityLedger`; journal entry status check blocks content updates |
| Concurrent finalization safe | Firestore transaction reads chain tail atomically |
| Content modification detected | `contentHash` is recomputed from live content on verification |
| Chain break detected | Each entry's `previousHash` must match the previous entry's `chainHash` |

---

## What this does NOT protect against

- A database administrator with direct Firestore access who modifies both the journal entry AND the integrity ledger entry
- Time-travel attacks (going back in Firestore history)

For stronger guarantees, the chain hashes could be anchored to an external immutable log (e.g., a public blockchain or a transparency log). This is a documented future improvement, not a current feature.
