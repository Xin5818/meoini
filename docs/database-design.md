# Meoini Database Design

**Project:** Meoini  
**Database:** PostgreSQL  
**Backend:** Go  
**Authentication:** Supabase Auth  
**Document Version:** 1.0  
**Status:** Initial Design

## 1. Design Objectives

Meoini currently uses IndexedDB (Dexie) to store decks, flashcards, and review progress in the browser.

The future architecture will introduce PostgreSQL and a Go backend to support:

- User account and personal data management
- Cloud synchronization across multiple devices
- Cloud storage for decks and flashcards
- Long-term review history
- User data isolation and access control

The database design aims to maintain compatibility with the existing TypeScript data models and minimize future migration work.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Database | PostgreSQL |
| Backend | Go |
| Authentication | Supabase Auth |
| Structured JSON data | JSONB |
| Array data | TEXT[] |
| Timestamp | TIMESTAMPTZ |
| Database migrations | SQL Migration |

## 3. Database Tables

The initial database design consists of four main tables.

| Table | Description |
|---|---|
| users | User profiles |
| decks | User-created vocabulary decks |
| flashcards | Vocabulary flashcards |
| review_logs | Flashcard review history |

### 3.1 users

Stores basic user profile information.

| Column | Data Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PRIMARY KEY | User ID linked to Supabase Auth |
| email | TEXT | Nullable | User email address |
| created_at | TIMESTAMPTZ | NOT NULL | Account creation time |

**Notes:**

- User IDs are provided by Supabase Auth.
- Each profile is associated with an authentication user.
- Deleting an authentication user cascades to the corresponding profile.

### 3.2 decks

Stores vocabulary decks created by users.

| Column | Data Type | Constraint | Description |
|---|---|---|---|
| id | TEXT | Composite PRIMARY KEY | Deck ID |
| user_id | UUID | FOREIGN KEY | Owner of the deck |
| name | TEXT | NOT NULL | Deck name |
| description | TEXT | NOT NULL | Deck description |
| language | TEXT | NOT NULL | Learning language |
| icon | TEXT | NOT NULL | Deck icon |
| color | TEXT | NOT NULL | Theme color |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |

**Primary key:**

`PRIMARY KEY (user_id, id)`

**Notes:**

- Each deck belongs to one user.
- A user cannot have duplicate deck IDs.
- Different users may have the same deck ID.
- The existing default deck ID, `default`, is preserved.

### 3.3 flashcards

Stores vocabulary flashcards and their learning information.

| Column | Data Type | Constraint | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | Flashcard ID |
| user_id | UUID | FOREIGN KEY | Owner of the flashcard |
| deck_id | TEXT | FOREIGN KEY | Associated deck |
| card_type | TEXT | NOT NULL | `dictionary` or `custom` |
| front | TEXT | Nullable | Card front |
| back | TEXT | Nullable | Card back |
| notes | TEXT | Nullable | Additional notes |
| audio_url | TEXT | Nullable | Audio URL |
| image_url | TEXT | Nullable | Image URL |
| word | TEXT | NOT NULL | Vocabulary word |
| language | TEXT | NOT NULL | Word language |
| meaning | TEXT | NOT NULL | Word meaning |
| part_of_speech | TEXT | Nullable | Part of speech |
| example | TEXT | Nullable | Example sentence |
| dictionary_entry | JSONB | Nullable | Complete dictionary entry |
| lookup_status | TEXT | Nullable | Dictionary lookup status |
| lookup_started_at | TIMESTAMPTZ | Nullable | Lookup start time |
| lookup_completed_at | TIMESTAMPTZ | Nullable | Lookup completion time |
| lookup_error | TEXT | Nullable | Lookup error message |
| last_reviewed_at | TIMESTAMPTZ | Nullable | Last review time |
| last_review_mode | TEXT | Nullable | `scheduled` or `early` |
| early_review_count | INTEGER | NOT NULL | Number of early reviews |
| tags | TEXT[] | NOT NULL | Flashcard tags |
| created_at | TIMESTAMPTZ | NOT NULL | Creation time |
| due_at | TIMESTAMPTZ | NOT NULL | Next scheduled review time |
| interval_days | INTEGER | NOT NULL | Review interval in days |
| repetitions | INTEGER | NOT NULL | Number of repetitions |
| updated_at | TIMESTAMPTZ | NOT NULL | Last update time |

**Notes:**

- `dictionary_entry` uses JSONB to store structured dictionary information.
- JSONB supports nested data such as meanings, pronunciations, word forms, examples, and compound word analysis.
- `tags` uses a PostgreSQL text array.
- `due_at` determines when a flashcard should be reviewed next.
- `updated_at` supports future cloud synchronization and conflict detection.
- The `id` column remains TEXT to maintain compatibility with existing flashcard IDs.

**Recommended constraints:**

- `card_type` must be `dictionary` or `custom`.
- `lookup_status` must be one of `pending`, `querying`, `found`, `not_found`, or `error`.
- `last_review_mode` must be `scheduled` or `early`.
- `early_review_count`, `interval_days`, and `repetitions` must be non-negative.

### 3.4 review_logs

Stores the result of each flashcard review.

| Column | Data Type | Constraint | Description |
|---|---|---|---|
| id | UUID | PRIMARY KEY | Review record ID |
| user_id | UUID | FOREIGN KEY | User who performed the review |
| flashcard_id | TEXT | FOREIGN KEY | Associated flashcard |
| rating | TEXT | NOT NULL | Review rating |
| review_mode | TEXT | NOT NULL | Review mode |
| reviewed_at | TIMESTAMPTZ | NOT NULL | Review timestamp |

**Rating values:**

- `again`: The user needs to review the card again.
- `hard`: The card was difficult to recall.
- `good`: The user recalled the card successfully.

**Review modes:**

- `scheduled`: A regularly scheduled review.
- `early`: An early review before the scheduled due date.

**Notes:**

- Each review creates a separate record.
- One flashcard can have multiple review records.
- Review history can be used for future statistics and learning progress features.
- Deleting a flashcard can cascade to its associated review records.

## 4. Database Relationships

| Relationship | Type | Description |
|---|---|---|
| users → decks | One-to-Many | One user can own multiple decks |
| users → flashcards | One-to-Many | One user can own multiple flashcards |
| decks → flashcards | One-to-Many | One deck can contain multiple flashcards |
| flashcards → review_logs | One-to-Many | One flashcard can have multiple review records |
| users → review_logs | One-to-Many | One user can have multiple review records |

**Data ownership rules:**

- Every deck must belong to a user.
- Every flashcard must belong to a user and a deck.
- Every review record must belong to a user and a flashcard.
- A flashcard's owner must match its deck's owner.
- Users can only access their own data.

## 5. Security Design

The database must enforce user-level data isolation.

Key security requirements:

1. Every user-owned record must be associated with a `user_id`.
2. The backend must validate the user's authentication.
3. The user ID must be obtained from verified authentication information.
4. The backend must not trust a `user_id` supplied directly by the frontend.
5. Database access must enforce ownership checks.

If the Go backend uses a privileged database connection, it must strictly enforce ownership checks. Privileged database credentials must never be exposed to the frontend.

## 6. Data Synchronization Design

The current version uses IndexedDB for local data storage.

After PostgreSQL integration, the planned architecture is:

- **IndexedDB:** Local caching and offline access.
- **PostgreSQL:** Persistent cloud storage.
- **Go API:** Data retrieval, updates, and synchronization.
- **Supabase Auth:** User authentication.

Synchronization must support:

- Creating flashcards
- Updating flashcards
- Deleting flashcards
- Updating decks
- Synchronizing review progress
- Handling conflicts caused by simultaneous updates from multiple devices

The `updated_at` column will be an important component of the future synchronization mechanism.

## 7. Index Design

The following indexes are planned for the initial implementation.

| Index | Table | Purpose |
|---|---|---|
| idx_flashcards_user_id | flashcards | Retrieve a user's flashcards |
| idx_flashcards_deck_id | flashcards | Retrieve flashcards by deck |
| idx_flashcards_due_at | flashcards | Retrieve flashcards due for review |
| idx_review_logs_flashcard_id | review_logs | Retrieve review history by flashcard |
| idx_review_logs_user_id | review_logs | Retrieve a user's review history |

Indexes may be adjusted based on actual query patterns and performance measurements.

## 8. Design Decisions and Future Work

The following decisions have been made:

- PostgreSQL will be used as the primary cloud database.
- Existing flashcard and deck ID formats will be preserved.
- JSONB will store complex dictionary information.
- A separate review history table will be introduced.
- Supabase Auth will manage user authentication.
- IndexedDB will remain available for local storage.

**Future implementation tasks:**

1. Create PostgreSQL table definitions.
2. Create the database Entity-Relationship Diagram (ERD).
3. Define API contracts using OpenAPI 3.0.
4. Design the migration process from IndexedDB to PostgreSQL.
5. Implement the Go backend.

---

**End of Document**
