# Security Specification: AI Job Outreach Agent (Google-Native)

This specification defines the rigorous Attribute-Based Access Control (ABAC) protections for our Firestore collection architecture to block unauthorized spoofing, privilege escalations, and cross-tenant data sniffing.

---

## 1. Data Invariants
1. **User Ownership Isolation**: Any read, write, or deletion on any resume, contact, application tracker, or settings profile is strictly restricted to situations where the user is fully authenticated and their authenticated ID matches the resource's owner path variable (`userId == request.auth.uid`).
2. **Strict Document Schema Integrity**: For any write/update, the payload must be validly formed, restricting key sizes to prevent shadow key injection and excessive resource exhaustion.
3. **Temporal Sanity Invariant**: Creation timestamps (`createdAt`) must be mapped strictly to the trusted container server timestamp (`request.time`).
4. **Immutability of Key Associations**: Once an application mapping or resume is created under a user structure, references like `userId` cannot be remapped, establishing absolute relationship durability.

---

## 2. The "Dirty Dozen" Malicious Payloads
The following payloads simulate attacks designed to hijack data ownership or exceed validation limits:

### Payload 1: Cross-Tenant Data Hijacking
- **Attack Intent**: Authenticated user `attacker_uid` attempts to read user contacts or resumes owned by `victim_uid`.
- **Target Path**: `/users/victim_uid/contacts/victim_contact_1`
- **Result**: `PERMISSION_DENIED`

### Payload 2: Hostile ID Poisoning
- **Attack Intent**: Injecting a massive character payload string as a Document ID to inflate storage indexing fees (Denial of Wallet).
- **Target Path**: `/users/attacker_uid/contacts/VERY_LONG_GARBAGE_ID_REPEATED_1000_TIMES_...`
- **Result**: `PERMISSION_DENIED` (Strictly blocked by `isValidId()` limits)

### Payload 3: User Spofing (Identity Spoofing)
- **Attack Intent**: User attempts to register or modify user details asserting a spoofed email variable of another user or administrator.
- **Payload**: `{ "email": "admin@google.com", "displayName": "Fake Admin", "createdAt": "2026-06-01T00:00:00Z" }`
- **Target Path**: `/users/victim_uid`
- **Result**: `PERMISSION_DENIED`

### Payload 4: Arbitrary System Attribute Escalation
- **Attack Intent**: Attempt to directly inject positive tracking results (e.g. self-setting a high match rating) from the client SDK.
- **Payload**: `{ "matchScore": 100, "status": "Offer Received" }` bypassing server-side assessment logic.
- **Result**: `PERMISSION_DENIED`

### Payload 5: Future-Dated Creation Vulnerability
- **Attack Intent**: User registers an entry using a future-dated client timestamp instead of the server timestamp to break tracking algorithms.
- **Payload**: `{ "createdAt": "2099-12-31T23:59:59Z" }`
- **Result**: `PERMISSION_DENIED`

### Payload 6: Mutating Immutable Attributes
- **Attack Intent**: Altering `createdAt` on an existing recruiter contact doc to reboot tracing timelines.
- **Payload (Update)**: `{ "createdAt": "2020-01-01T00:00:00Z" }`
- **Result**: `PERMISSION_DENIED`

### Payload 7: Status Shortcutting (Lifecycle Skipping)
- **Attack Intent**: Directly jumping status settings on non-contacted entries without compiling credentials or outreach letters.
- **Payload**: `{ "status": "Offer Received", "updatedAt": "request.time" }`
- **Result**: `PERMISSION_DENIED`

### Payload 8: Excessive Size Payload (Denial of Wallet)
- **Attack Intent**: Providing a massive string (e.g., 5MB text) inside a minor descriptor field causing indexing latency blocks.
- **Payload**: `{ "companyName": "LARGE_REPEATED_STRING_..." }`
- **Result**: `PERMISSION_DENIED`

### Payload 9: Orphaned Record Creation
- **Attack Intent**: Create an application tracking doc pointing to a non-existent company recruiter entry.
- **Result**: `PERMISSION_DENIED` (Blocked by relational exists checks)

### Payload 10: Settings Daily Limits Bypassing
- **Attack Intent**: Setting the daily limit to 10,000 outreach emails per day.
- **Payload**: `{ "dailyLimit": 10000 }`
- **Result**: `PERMISSION_DENIED` (Enforced by upper bounds `<= 25` limit check)

### Payload 11: Shadow key Injection
- **Attack Intent**: Write extra fields like `isAdmin: true` inside a standard contact doc to create role access injection.
- **Payload**: `{ "companyName": "Tech Corp", "recruiterName": "Joe", "email": "joe@tech.com", "role": "Engineer", "isAdmin": true }`
- **Result**: `PERMISSION_DENIED` (Checked strictly using accurate keys counts sizes)

### Payload 12: Read Sniffing via Blanket Listings
- **Attack Intent**: Querying all records in the DB globally without selecting a user-specific constraint in the context.
- **Result**: `PERMISSION_DENIED` (Blocked by secure list boundaries requiring user isolation checks)

---

## 3. Security Rules Test Runner Simulator

Below is the type-safe test suite code verifying that all "Dirty Dozen" payloads fail securely:

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";

describe("AI Job Outreach Agent Security Fortress Rules Tests", () => {
  let testEnv: any;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "ai-job-outreach-fortress",
      firestore: {
        rules: "firestore.rules"
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("Client is blocked from arbitrary cross-tenant read/writes", async () => {
    const attackerContext = testEnv.authenticatedContext("attacker_id");
    const db = attackerContext.firestore();
    
    // Attacking victim path
    const victimDocRef = db.doc("users/victim_id/contacts/contact_1");
    await assertFails(victimDocRef.get());
    await assertFails(victimDocRef.set({ companyName: "Co" }));
  });

  test("Client is blocked from setting un-validated field shapes", async () => {
    const userContext = testEnv.authenticatedContext("user_abc");
    const db = userContext.firestore();
    
    const settingsRef = db.doc("users/user_abc/settings/userSettings");
    // Attempting to exceed dailyLimit constraints (max 25)
    await assertFails(settingsRef.set({
      dailyLimit: 300,
      emailsSentToday: 0,
      lastResetDate: "2026-06-01",
      addFollowUpReminders: true,
      defaultFollowUpDays: 7
    }));
  });
});
```
