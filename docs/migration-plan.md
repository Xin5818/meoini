# IndexedDB to PostgreSQL Migration Plan

## 1. Purpose

This document defines a safe migration strategy for transferring existing Meoini user data from browser IndexedDB to PostgreSQL hosted by Supabase.

The migration must preserve existing flashcards, decks, dictionary information, and review scheduling state while preventing data loss, duplication, and cross-user data exposure.

The migration is designed for a future architecture consisting of:

- **Frontend:** React, TypeScript, and IndexedDB
- **Backend:** Go REST API
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL

## 2. Migration Principles

The migration must follow these principles:

1. **Local data preservation:** Never delete IndexedDB data before cloud migration has been verified.
2. **Idempotency:** Retrying a migration must not create duplicate records.
3. **Data integrity:** Preserve existing identifiers, relationships, and review scheduling state.
4. **User isolation:** Every migrated record must belong to the authenticated user.
5. **Recoverability:** Failed or interrupted migrations must be safely resumable.
6. **Explicit cutover:** Switch the primary data source only after successful verification.

## 3. Existing Data Sources

The current application stores data in browser IndexedDB through Dexie.

The existing tables are:

| IndexedDB table | PostgreSQL table |
|---|---|
| `decks` | `decks` |
| `flashcards` | `flashcards` |

The current application does not maintain a separate review history table. Review scheduling information is stored directly on each flashcard.

## 4. Data Mapping

### 4.1 Decks

Map existing deck records to the PostgreSQL `decks` table.

| IndexedDB field | PostgreSQL field | Migration rule |
|---|---|---|
| `id` | `id` | Preserve the original ID |
| `name` | `name` | Copy |
| `description` | `description` | Copy |
| `language` | `language` | Copy |
| `icon` | `icon` | Copy |
| `color` | `color` | Copy |
| `createdAt` | `created_at` | Convert to TIMESTAMPTZ |
| `updatedAt` | `updated_at` | Convert to TIMESTAMPTZ |
| Not available | `user_id` | Derive from authenticated user |

The default deck must retain its existing ID: `default`.

### 4.2 Flashcards

Map existing flashcard records to the PostgreSQL `flashcards` table.

| IndexedDB field | PostgreSQL field | Migration rule |
|---|---|---|
| `id` | `id` | Preserve the original ID |
| `deckId` | `deck_id` | Preserve the original deck reference |
| `cardType` | `card_type` | Copy |
| `front` | `front` | Copy |
| `back` | `back` | Copy |
| `notes` | `notes` | Copy |
| `audioUrl` | `audio_url` | Copy |
| `imageUrl` | `image_url` | Copy |
| `word` | `word` | Copy |
| `language` | `language` | Copy |
| `meaning` | `meaning` | Copy |
| `partOfSpeech` | `part_of_speech` | Copy |
| `example` | `example` | Copy |
| `dictionaryEntry` | `dictionary_entry` | Preserve as JSONB |
| `lookupStatus` | `lookup_status` | Copy |
| `lookupStartedAt` | `lookup_started_at` | Convert to TIMESTAMPTZ |
| `lookupCompletedAt` | `lookup_completed_at` | Convert to TIMESTAMPTZ |
| `lookupError` | `lookup_error` | Copy |
| `lastReviewedAt` | `last_reviewed_at` | Convert to TIMESTAMPTZ |
| `lastReviewMode` | `last_review_mode` | Copy |
| `earlyReviewCount` | `early_review_count` | Copy |
| `tags` | `tags` | Copy as TEXT[] |
| `createdAt` | `created_at` | Convert to TIMESTAMPTZ |
| `dueAt` | `due_at` | Convert to TIMESTAMPTZ |
| `intervalDays` | `interval_days` | Copy |
| `repetitions` | `repetitions` | Copy |
| Not available | `user_id` | Derive from authenticated user |

All existing flashcard IDs and deck references must be preserved.

Optional fields must remain nullable. Missing optional values must not be replaced with invented data.

### 4.3 Review History

The current IndexedDB model stores the latest review scheduling state on each flashcard.

It does not contain a complete historical record of individual review events.

Therefore:

- Preserve `lastReviewedAt`, `lastReviewMode`, `earlyReviewCount`, `dueAt`, `intervalDays`, and `repetitions`.
- Do not generate artificial historical records.
- Start recording new review events in PostgreSQL `review_logs` after the migration.
- Treat historical review logs as unavailable unless another reliable source is introduced.

## 5. Migration Workflow

### Phase 1: Preparation

Before migration:

1. Require the user to sign in through Supabase Auth.
2. Obtain the authenticated user's identity from the verified access token.
3. Check that the user has sufficient local storage and that IndexedDB can be read.
4. Read all existing decks and flashcards.
5. Validate IDs, deck references, timestamps, and required fields.
6. Create a consistent migration snapshot.

The frontend must temporarily prevent data-changing operations during the initial snapshot and upload, or queue those operations until migration completes.

This prevents changes made during migration from being omitted.

### Phase 2: Local Backup

Before uploading anything:

1. Export all decks and flashcards from IndexedDB.
2. Save a local backup in a documented export format.
3. Record the export timestamp and application data version.
4. Keep the original IndexedDB records unchanged.

The backup should contain user data only. It must not contain authentication tokens, passwords, or API secrets.

### Phase 3: Data Transformation

Transform the local snapshot into the PostgreSQL API format.

The transformation must:

- Convert JavaScript timestamps in milliseconds to ISO 8601 timestamps.
- Preserve original IDs and deck relationships.
- Preserve dictionary entry objects as JSON.
- Preserve optional fields and arrays.
- Validate required values and supported enum values.
- Normalize invalid or stale lookup states only according to an explicit migration rule.

For example, a flashcard with a stale dictionary lookup state may need to be marked as `pending` so that the application can retry the lookup later.

Transformation must not silently discard unsupported data.

### Phase 4: Cloud Import

The frontend sends the transformed data to the Go backend using an authenticated API request.

The backend must:

1. Validate the Supabase JWT.
2. Derive `user_id` from the verified token.
3. Ignore or reject any client-supplied ownership identity.
4. Validate the imported records.
5. Confirm that every referenced deck belongs to the authenticated user.
6. Import records using database transactions.
7. Return an import summary.

The import operation must be idempotent.

Use the combination of `user_id` and the original record ID to identify an existing record. Repeated requests must not create duplicates.

A dedicated batch import endpoint is recommended:

`POST /api/migrations/indexeddb`

The endpoint should support an import identifier so the backend can recognize retries of the same migration.

Large datasets should be imported in manageable batches. The backend must report which batches succeeded and which failed.

### Phase 5: Data Verification

After import, compare the local snapshot with the cloud records.

Verification must include:

| Check | Expected result |
|---|---|
| Deck count | Matches the local snapshot |
| Flashcard count | Matches the local snapshot |
| Deck IDs | All preserved |
| Flashcard IDs | All preserved |
| Deck relationships | All valid |
| User ownership | All records belong to the authenticated user |
| Dictionary entries | JSON content preserved |
| Tags | Values preserved |
| Review scheduling state | Values preserved |
| Timestamps | Correctly converted |

The backend should return a migration summary containing:

- Number of imported decks
- Number of imported flashcards
- Number of skipped existing records
- Number of failed records
- Verification status

The migration is successful only when all required records have been imported and verified.

### Phase 6: Application Cutover

After successful verification:

1. Mark the migration as completed.
2. Switch the application to use the Go API as its primary data source.
3. Continue using IndexedDB as a local cache and offline storage layer.
4. Synchronize local changes with the backend when connectivity is available.
5. Keep the original local data until the user has confirmed that the cloud data is accessible.

The frontend must handle network failures and temporary offline states without losing local changes.

## 6. Failure Recovery

The migration must support recovery from the following situations:

| Failure scenario | Recovery strategy |
|---|---|
| Browser closed during migration | Resume using the saved migration state |
| Network interruption | Retry failed batches |
| Duplicate import request | Use idempotent import logic |
| Invalid record | Report the record and validation error |
| Missing deck reference | Reject the affected flashcard and report the issue |
| Database transaction failure | Roll back the affected transaction |
| Verification failure | Keep IndexedDB as the primary data source |
| Authentication expiration | Require re-authentication before resuming |

A failed migration must never trigger automatic deletion of local data.

## 7. Conflict Handling

During the initial migration, the backend should treat the local snapshot as the source of truth for records being imported.

For an existing record with the same user ID and record ID:

- Do not create another record.
- Do not overwrite an existing cloud record blindly.
- Compare the record and determine whether it is an identical retry or a genuine conflict.
- Report genuine conflicts for explicit resolution.

After the initial migration, synchronization conflicts should be handled using a separately designed synchronization strategy.

A future synchronization system may introduce:

- `updated_at` comparisons
- Server-side version numbers
- Client-generated operation IDs
- A synchronization queue or outbox
- Explicit conflict resolution rules

## 8. Security Requirements

All migration operations must follow these rules:

- Require a valid authenticated session.
- Derive ownership from the verified Supabase JWT.
- Never trust a `user_id` supplied by the browser.
- Validate all incoming data on the backend.
- Prevent users from importing records into another user's account.
- Use HTTPS for all network communication.
- Never expose Supabase service-role credentials in frontend code.
- Keep database credentials and backend secrets outside Git.

Database access policies and backend authorization must be configured to enforce user-level data isolation.

## 9. Migration State

The application should maintain a migration state to support retries and recovery.

Suggested states:

| State | Description |
|---|---|
| `not_started` | No migration has been attempted |
| `preparing` | Local data is being collected and validated |
| `exported` | Local backup has been created |
| `importing` | Data is being uploaded |
| `verifying` | Cloud data is being checked |
| `completed` | Migration succeeded |
| `failed` | Migration requires recovery |

The migration state should include:

- Migration ID
- User ID
- Application data version
- Start timestamp
- Completion timestamp
- Import counts
- Verification result
- Last error, if any

Migration state must not be used as a substitute for verifying the actual database records.

## 10. Post-Migration Strategy

After the initial migration, Meoini should operate as an offline-capable application with cloud synchronization.

The intended data flow is:

1. The user creates or updates data in the frontend.
2. IndexedDB stores local changes immediately.
3. The frontend queues changes for synchronization.
4. The Go backend validates and processes synchronization requests.
5. PostgreSQL stores the authoritative cloud records.
6. The frontend updates its local cache after successful synchronization.

This approach allows users to continue using Meoini when the network is unavailable.

## 11. Implementation Order

The migration should be implemented in the following order:

1. Implement local data export and backup.
2. Implement data validation and transformation.
3. Add the authenticated Go migration endpoint.
4. Implement transactional and idempotent batch imports.
5. Implement cloud verification and migration status tracking.
6. Add the frontend migration interface.
7. Switch to API-based data access after successful verification.
8. Implement ongoing offline synchronization.

## 12. Acceptance Criteria

The migration is considered complete when:

- All existing decks and flashcards are preserved.
- Original IDs and deck relationships remain unchanged.
- Dictionary information and review scheduling state are preserved.
- No duplicate records are created after retries.
- All imported records belong to the authenticated user.
- The migration can recover from interrupted uploads.
- Failed migrations leave local data intact.
- The application can read cloud data after cutover.
- IndexedDB remains available as a local cache for offline use.

## 13. Current Implementation Status

The migration strategy is currently a design specification.

| Component | Status |
|---|---|
| IndexedDB data model | Existing |
| PostgreSQL schema | Designed |
| Supabase Auth | Planned |
| Go backend | Planned |
| Migration API | Planned |
| Local export and backup | Planned |
| Cloud import | Planned |
| Data verification | Planned |
| Offline synchronization | Planned |

No existing IndexedDB data is migrated or deleted by this document.# IndexedDB to PostgreSQL Migration Plan

## 1. Purpose

This document defines a safe migration strategy for transferring existing Meoini user data from browser IndexedDB to PostgreSQL hosted by Supabase.

The migration must preserve existing flashcards, decks, dictionary information, and review scheduling state while preventing data loss, duplication, and cross-user data exposure.

The migration is designed for a future architecture consisting of:

- **Frontend:** React, TypeScript, and IndexedDB
- **Backend:** Go REST API
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL

## 2. Migration Principles

The migration must follow these principles:

1. **Local data preservation:** Never delete IndexedDB data before cloud migration has been verified.
2. **Idempotency:** Retrying a migration must not create duplicate records.
3. **Data integrity:** Preserve existing identifiers, relationships, and review scheduling state.
4. **User isolation:** Every migrated record must belong to the authenticated user.
5. **Recoverability:** Failed or interrupted migrations must be safely resumable.
6. **Explicit cutover:** Switch the primary data source only after successful verification.

## 3. Existing Data Sources

The current application stores data in browser IndexedDB through Dexie.

The existing tables are:

| IndexedDB table | PostgreSQL table |
|---|---|
| `decks` | `decks` |
| `flashcards` | `flashcards` |

The current application does not maintain a separate review history table. Review scheduling information is stored directly on each flashcard.

## 4. Data Mapping

### 4.1 Decks

Map existing deck records to the PostgreSQL `decks` table.

| IndexedDB field | PostgreSQL field | Migration rule |
|---|---|---|
| `id` | `id` | Preserve the original ID |
| `name` | `name` | Copy |
| `description` | `description` | Copy |
| `language` | `language` | Copy |
| `icon` | `icon` | Copy |
| `color` | `color` | Copy |
| `createdAt` | `created_at` | Convert to TIMESTAMPTZ |
| `updatedAt` | `updated_at` | Convert to TIMESTAMPTZ |
| Not available | `user_id` | Derive from authenticated user |

The default deck must retain its existing ID: `default`.

### 4.2 Flashcards

Map existing flashcard records to the PostgreSQL `flashcards` table.

| IndexedDB field | PostgreSQL field | Migration rule |
|---|---|---|
| `id` | `id` | Preserve the original ID |
| `deckId` | `deck_id` | Preserve the original deck reference |
| `cardType` | `card_type` | Copy |
| `front` | `front` | Copy |
| `back` | `back` | Copy |
| `notes` | `notes` | Copy |
| `audioUrl` | `audio_url` | Copy |
| `imageUrl` | `image_url` | Copy |
| `word` | `word` | Copy |
| `language` | `language` | Copy |
| `meaning` | `meaning` | Copy |
| `partOfSpeech` | `part_of_speech` | Copy |
| `example` | `example` | Copy |
| `dictionaryEntry` | `dictionary_entry` | Preserve as JSONB |
| `lookupStatus` | `lookup_status` | Copy |
| `lookupStartedAt` | `lookup_started_at` | Convert to TIMESTAMPTZ |
| `lookupCompletedAt` | `lookup_completed_at` | Convert to TIMESTAMPTZ |
| `lookupError` | `lookup_error` | Copy |
| `lastReviewedAt` | `last_reviewed_at` | Convert to TIMESTAMPTZ |
| `lastReviewMode` | `last_review_mode` | Copy |
| `earlyReviewCount` | `early_review_count` | Copy |
| `tags` | `tags` | Copy as TEXT[] |
| `createdAt` | `created_at` | Convert to TIMESTAMPTZ |
| `dueAt` | `due_at` | Convert to TIMESTAMPTZ |
| `intervalDays` | `interval_days` | Copy |
| `repetitions` | `repetitions` | Copy |
| Not available | `user_id` | Derive from authenticated user |

All existing flashcard IDs and deck references must be preserved.

Optional fields must remain nullable. Missing optional values must not be replaced with invented data.

### 4.3 Review History

The current IndexedDB model stores the latest review scheduling state on each flashcard.

It does not contain a complete historical record of individual review events.

Therefore:

- Preserve `lastReviewedAt`, `lastReviewMode`, `earlyReviewCount`, `dueAt`, `intervalDays`, and `repetitions`.
- Do not generate artificial historical records.
- Start recording new review events in PostgreSQL `review_logs` after the migration.
- Treat historical review logs as unavailable unless another reliable source is introduced.

## 5. Migration Workflow

### Phase 1: Preparation

Before migration:

1. Require the user to sign in through Supabase Auth.
2. Obtain the authenticated user's identity from the verified access token.
3. Check that the user has sufficient local storage and that IndexedDB can be read.
4. Read all existing decks and flashcards.
5. Validate IDs, deck references, timestamps, and required fields.
6. Create a consistent migration snapshot.

The frontend must temporarily prevent data-changing operations during the initial snapshot and upload, or queue those operations until migration completes.

This prevents changes made during migration from being omitted.

### Phase 2: Local Backup

Before uploading anything:

1. Export all decks and flashcards from IndexedDB.
2. Save a local backup in a documented export format.
3. Record the export timestamp and application data version.
4. Keep the original IndexedDB records unchanged.

The backup should contain user data only. It must not contain authentication tokens, passwords, or API secrets.

### Phase 3: Data Transformation

Transform the local snapshot into the PostgreSQL API format.

The transformation must:

- Convert JavaScript timestamps in milliseconds to ISO 8601 timestamps.
- Preserve original IDs and deck relationships.
- Preserve dictionary entry objects as JSON.
- Preserve optional fields and arrays.
- Validate required values and supported enum values.
- Normalize invalid or stale lookup states only according to an explicit migration rule.

For example, a flashcard with a stale dictionary lookup state may need to be marked as `pending` so that the application can retry the lookup later.

Transformation must not silently discard unsupported data.

### Phase 4: Cloud Import

The frontend sends the transformed data to the Go backend using an authenticated API request.

The backend must:

1. Validate the Supabase JWT.
2. Derive `user_id` from the verified token.
3. Ignore or reject any client-supplied ownership identity.
4. Validate the imported records.
5. Confirm that every referenced deck belongs to the authenticated user.
6. Import records using database transactions.
7. Return an import summary.

The import operation must be idempotent.

Use the combination of `user_id` and the original record ID to identify an existing record. Repeated requests must not create duplicates.

A dedicated batch import endpoint is recommended:

`POST /api/migrations/indexeddb`

The endpoint should support an import identifier so the backend can recognize retries of the same migration.

Large datasets should be imported in manageable batches. The backend must report which batches succeeded and which failed.

### Phase 5: Data Verification

After import, compare the local snapshot with the cloud records.

Verification must include:

| Check | Expected result |
|---|---|
| Deck count | Matches the local snapshot |
| Flashcard count | Matches the local snapshot |
| Deck IDs | All preserved |
| Flashcard IDs | All preserved |
| Deck relationships | All valid |
| User ownership | All records belong to the authenticated user |
| Dictionary entries | JSON content preserved |
| Tags | Values preserved |
| Review scheduling state | Values preserved |
| Timestamps | Correctly converted |

The backend should return a migration summary containing:

- Number of imported decks
- Number of imported flashcards
- Number of skipped existing records
- Number of failed records
- Verification status

The migration is successful only when all required records have been imported and verified.

### Phase 6: Application Cutover

After successful verification:

1. Mark the migration as completed.
2. Switch the application to use the Go API as its primary data source.
3. Continue using IndexedDB as a local cache and offline storage layer.
4. Synchronize local changes with the backend when connectivity is available.
5. Keep the original local data until the user has confirmed that the cloud data is accessible.

The frontend must handle network failures and temporary offline states without losing local changes.

## 6. Failure Recovery

The migration must support recovery from the following situations:

| Failure scenario | Recovery strategy |
|---|---|
| Browser closed during migration | Resume using the saved migration state |
| Network interruption | Retry failed batches |
| Duplicate import request | Use idempotent import logic |
| Invalid record | Report the record and validation error |
| Missing deck reference | Reject the affected flashcard and report the issue |
| Database transaction failure | Roll back the affected transaction |
| Verification failure | Keep IndexedDB as the primary data source |
| Authentication expiration | Require re-authentication before resuming |

A failed migration must never trigger automatic deletion of local data.

## 7. Conflict Handling

During the initial migration, the backend should treat the local snapshot as the source of truth for records being imported.

For an existing record with the same user ID and record ID:

- Do not create another record.
- Do not overwrite an existing cloud record blindly.
- Compare the record and determine whether it is an identical retry or a genuine conflict.
- Report genuine conflicts for explicit resolution.

After the initial migration, synchronization conflicts should be handled using a separately designed synchronization strategy.

A future synchronization system may introduce:

- `updated_at` comparisons
- Server-side version numbers
- Client-generated operation IDs
- A synchronization queue or outbox
- Explicit conflict resolution rules

## 8. Security Requirements

All migration operations must follow these rules:

- Require a valid authenticated session.
- Derive ownership from the verified Supabase JWT.
- Never trust a `user_id` supplied by the browser.
- Validate all incoming data on the backend.
- Prevent users from importing records into another user's account.
- Use HTTPS for all network communication.
- Never expose Supabase service-role credentials in frontend code.
- Keep database credentials and backend secrets outside Git.

Database access policies and backend authorization must be configured to enforce user-level data isolation.

## 9. Migration State

The application should maintain a migration state to support retries and recovery.

Suggested states:

| State | Description |
|---|---|
| `not_started` | No migration has been attempted |
| `preparing` | Local data is being collected and validated |
| `exported` | Local backup has been created |
| `importing` | Data is being uploaded |
| `verifying` | Cloud data is being checked |
| `completed` | Migration succeeded |
| `failed` | Migration requires recovery |

The migration state should include:

- Migration ID
- User ID
- Application data version
- Start timestamp
- Completion timestamp
- Import counts
- Verification result
- Last error, if any

Migration state must not be used as a substitute for verifying the actual database records.

## 10. Post-Migration Strategy

After the initial migration, Meoini should operate as an offline-capable application with cloud synchronization.

The intended data flow is:

1. The user creates or updates data in the frontend.
2. IndexedDB stores local changes immediately.
3. The frontend queues changes for synchronization.
4. The Go backend validates and processes synchronization requests.
5. PostgreSQL stores the authoritative cloud records.
6. The frontend updates its local cache after successful synchronization.

This approach allows users to continue using Meoini when the network is unavailable.

## 11. Implementation Order

The migration should be implemented in the following order:

1. Implement local data export and backup.
2. Implement data validation and transformation.
3. Add the authenticated Go migration endpoint.
4. Implement transactional and idempotent batch imports.
5. Implement cloud verification and migration status tracking.
6. Add the frontend migration interface.
7. Switch to API-based data access after successful verification.
8. Implement ongoing offline synchronization.

## 12. Acceptance Criteria

The migration is considered complete when:

- All existing decks and flashcards are preserved.
- Original IDs and deck relationships remain unchanged.
- Dictionary information and review scheduling state are preserved.
- No duplicate records are created after retries.
- All imported records belong to the authenticated user.
- The migration can recover from interrupted uploads.
- Failed migrations leave local data intact.
- The application can read cloud data after cutover.
- IndexedDB remains available as a local cache for offline use.

## 13. Current Implementation Status

The migration strategy is currently a design specification.

| Component | Status |
|---|---|
| IndexedDB data model | Existing |
| PostgreSQL schema | Designed |
| Supabase Auth | Planned |
| Go backend | Planned |
| Migration API | Planned |
| Local export and backup | Planned |
| Cloud import | Planned |
| Data verification | Planned |
| Offline synchronization | Planned |

No existing IndexedDB data is migrated or deleted by this document.
