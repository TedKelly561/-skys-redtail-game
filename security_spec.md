# Security Specification — Whiskers' River Journey

## 1. Data Invariants
1. **Identity Isolation**: A `UserProgress` document at `/users/{userId}` can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId` and whose `email_verified == true`.
2. **UID Immutability**: `data.uid` must equal `request.auth.uid` on creation and must remain immutable (`incoming().uid == existing().uid`) on update.
3. **Strict Schema & Volumetric Bounds**: Only the exact 13 defined fields in `UserProgress` are permitted (`hasAll` and `hasOnly`). `displayName` must be a string with `1 <= size() <= 100`. All counters must be non-negative numbers (`>= 0` and `<= 10000000`). `highestChapter` must be between `1` and `5`.
4. **Temporal Integrity**: `updatedAt` must strictly equal `request.time`.
5. **Extras Isolation**: `/userExtras/{userId}` (friends, outfits, fish house, buddy) follows the same owner-only rules: exactly its 13 fields, `uid == request.auth.uid` and immutable, lists capped (friends ≤ 20, closet ≤ 60, house ≤ 20), strings capped, spent counters within bounds, `lakeUnlocked` a boolean, `updatedAt == request.time`. It is a separate document so the main progress save never depends on it.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting to create `/users/user_1`.
2. **Unverified Email Spoof**: `auth = { uid: 'user_1', token: { email_verified: false } }` attempting to create `/users/user_1`.
3. **Cross-User Read (PII/Progress Leak)**: `auth = { uid: 'user_2' }` attempting `get` on `/users/user_1`.
4. **UID Spoofing on Create**: `auth = { uid: 'user_1' }` creating `/users/user_1` with `{ uid: 'user_2', ... }`.
5. **Shadow / Ghost Field Injection**: Payload including `{ ..., isAdmin: true }`.
6. **Oversized String DoS**: `displayName` with 5,000 characters (`size() > 100`).
7. **Negative Score Manipulation**: `totalPoints: -500`.
8. **Type Poisoning on Update**: Updating `starsCollected` to `"999999"`.
9. **Forged Client Timestamp**: Setting `updatedAt` to a past/future timestamp instead of `request.time`.
10. **UID Mutation on Update**: Changing `uid` during an `update` call.
11. **Malformed Document ID Poisoning**: Creating `/users/bad$id!@#` failing `isValidId(userId)`.
12. **Unauthorized Collection Access**: Writing to `/unprotected_collection/doc1` caught by global default-deny net.
