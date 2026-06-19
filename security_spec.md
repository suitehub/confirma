# Security Specification for Confirma Practice Database

## 1. Data Invariants
- **Owner Isolation**: A psychologist can ONLY access, create, update, or read documents inside the `/users/{userId}` collection path if their authenticated UID matches the `{userId}` path parameter.
- **Identity Integrity**: No user can read or modify the workspace or patient records of another psychologist.
- **Temporal Enforcement**: All write operations MUST assert that `updatedAt` is updated with `request.time`. Client-side timestamps are strictly rejected.
- **Strict Verification**: To execute any write, the user's email verification claim must be active (unless specifically overridden, but here we enforce `request.auth.token.email_verified == true` for solid protection).

## 2. The "Dirty Dozen" Malicious Payloads
Here are the 12 scenarios designed to compromise the system and verify block behaviors:

1. **Other User Hack (Identity Spoofing)**: Attempt to read `/users/victim_user_123` when authenticated as `attacker_999`.
2. **Global Query Leak (Unsecured List)**: Attempt to list all documents under `/users` without restricting the query to the user's own UID.
3. **Unauthenticated Write (No Auth Session)**: Attempt to create `/users/some_uid` with a valid model when `request.auth` is `null`.
4. **False Email Verification Exploit**: Attempt to write `/users/user_777` when authenticated as `user_777` but with `email_verified == false`.
5. **Path ID Poisoning**: Attempt to target a document like `/users/invalid-id-that-is-too-long-and-contains-harmful-symbols-$$$-###`.
6. **Immutable Timestamp Cheat**: Attempt to update `/users/user_123` with a static client-side date like `"2026-01-01T00:00:00Z"` for `updatedAt` instead of `request.time`.
7. **Ghost Field Injection**: Attempt to execute an update containing a field like `isAdmin: true` or `subscriptionStatus: "premium_free"` inside the `/users/{userId}` root.
8. **Invalid State Payload (Type Poisoning)**: Attempt to write the `state` field with a string instead of an Object.
9. **Forced Empty Root Write**: Write a document omitting the `state` or `updatedAt` keys entirely on create.
10. **Victim Write hijacking**: Attempt to update `/users/victim_user_123` with complete schema when signed in as `attacker_999`.
11. **Malicious Administrative Spoof**: Attempting to declare an `admin` role parameter in metadata within a personal document.
12. **Recursive Array Exhaustion Hack**: Injecting extremely oversized payloads to exhaust storage limitations.

## 3. Test Runner Design (`firestore.rules.test.ts`)
The `firestore.rules.test.ts` outlines our testing scenario to ensure Firestore rules successfully reject all these malicious attempts. Security rules must be compiled and validated against these behaviors.
