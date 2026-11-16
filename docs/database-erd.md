# Meoini Database Entity Relationship Diagram

## 1. Overview

This diagram illustrates the relationships between the four main database tables:

- `users`
- `decks`
- `flashcards`
- `review_logs`

## 2. Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ DECKS : owns
    USERS ||--o{ FLASHCARDS : owns
    USERS ||--o{ REVIEW_LOGS : performs
    DECKS ||--o{ FLASHCARDS : contains
    FLASHCARDS ||--o{ REVIEW_LOGS : has

    USERS {
        UUID id PK
        TEXT email
        TIMESTAMPTZ created_at
    }

    DECKS {
        TEXT id PK
        UUID user_id FK
        TEXT name
        TEXT description
        TEXT language
        TEXT icon
        TEXT color
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    FLASHCARDS {
        TEXT id PK
        UUID user_id FK
        TEXT deck_id FK
        TEXT card_type
        TEXT word
        TEXT language
        TEXT meaning
        JSONB dictionary_entry
        TEXT_ARRAY tags
        TIMESTAMPTZ due_at
        INTEGER interval_days
        INTEGER repetitions
        TIMESTAMPTZ updated_at
    }

    REVIEW_LOGS {
        UUID id PK
        UUID user_id FK
        TEXT flashcard_id FK
        TEXT rating
        TEXT review_mode
        TIMESTAMPTZ reviewed_at
    }
```

## 3. Relationship Descriptions

| Relationship | Cardinality | Description |
|---|---|---|
| Users → Decks | One-to-Many | A user can own multiple decks |
| Users → Flashcards | One-to-Many | A user can own multiple flashcards |
| Users → Review Logs | One-to-Many | A user can have multiple review records |
| Decks → Flashcards | One-to-Many | A deck can contain multiple flashcards |
| Flashcards → Review Logs | One-to-Many | A flashcard can have multiple review records |

## 4. Data Ownership

Every user-owned record is associated with a `user_id`.

The database must ensure that:

- A user can only access their own decks.
- A flashcard must belong to the same user as its deck.
- A review record must belong to the same user as its flashcard.
- Deleting a user removes their associated data.

## 5. Design Notes

- Deck IDs are scoped to users through the composite primary key `(user_id, id)`.
- Flashcard IDs are globally unique.
- Dictionary information is stored in JSONB.
- Review history is stored separately from flashcard scheduling data.
- The diagram represents the planned database structure.

---

**End of Document**
