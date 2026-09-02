# Firestore Security Model

## Design Principles

1. **Deny by default** — all access is denied unless explicitly permitted
2. **User isolation** — users can only access their own data (`/users/{uid}`)
3. **Server-controlled integrity** — clients cannot write to `integrityLedger`
4. **Draft-only mutations** — clients cannot modify finalized journal entries
5. **No deletion** — conversations, messages, and journal entries cannot be deleted

## Rule Summary

| Collection | Create | Read | Update | Delete |
|---|---|---|---|---|
| `/users/{uid}` | Own | Own | Own | ✗ |
| `/users/{uid}/conversations` | Own (uid must match) | Own | Own | ✗ |
| `/users/{uid}/conversations/messages` | Own (uid must match) | Own | ✗ | ✗ |
| `/users/{uid}/journalEntries` | Own (draft only) | Own | Own (draft only) | ✗ |
| `/users/{uid}/integrityLedger` | ✗ (backend only) | Own | ✗ | ✗ |

## Key Rules Explained

### Why can't clients write to `integrityLedger`?

The integrity ledger is written exclusively by the Firebase Admin SDK on the backend. Admin SDK operations bypass Firestore security rules. This means:

- A client trying to create/modify a ledger entry will get a `PERMISSION_DENIED` error
- The backend can write to it freely (as a trusted server)
- This prevents clients from forging their own hash chain entries

### Why can't finalized journal entries be updated?

The update rule for `journalEntries` checks `resource.data.status == 'draft'`. Once the backend sets `status` to `'finalized'` (via Admin SDK during finalization), the client can no longer update the entry — the rule blocks it.

Even if a client tried to update via the API, the backend also checks the status before allowing updates.

### Why can't entries be deleted?

Deletion would silently break the hash chain (no entry to verify against). The rules explicitly prevent this. Future improvement: allow soft-deletion with a `deleted` flag instead.

## Testing the Rules

With the Firebase Emulator:

```bash
firebase emulators:start --only firestore
# Then run your test suite against the emulator
```

Key tests:
- A user with `uid=A` cannot read `/users/B/journalEntries`
- A client cannot write to `/users/A/integrityLedger`
- A client cannot update a finalized journal entry
