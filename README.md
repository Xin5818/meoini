# Meoini

A Finnish and English dictionary with flashcards, spaced repetition, pronunciation support, and offline access.

**Live Demo:** https://xin5818.github.io/meoini/

## Overview

Meoini is a bilingual Finnish-English vocabulary learning application. It combines dictionary lookup, flashcards, spaced repetition, and pronunciation support to help users build and review vocabulary.

The application is designed as an offline-capable Progressive Web App (PWA), with local data storage and optional account authentication.

## Features

- **Dictionary:** Look up Finnish and English words with spelling-tolerant suggestions.
- **Flashcards:** Save vocabulary and organize it into decks.
- **Spaced Repetition:** Review vocabulary using a scheduled review system.
- **Pronunciation:** Access Finnish pronunciation information, IPA, and audio where available.
- **Import and Export:** Import vocabulary from TXT and CSV files.
- **Offline Access:** Use the application offline through PWA support.
- **Authentication:** Register, sign in, sign out, and recover sessions with Supabase Auth.

## Development Status

| Component | Status |
|---|---|
| Dictionary and vocabulary lookup | Implemented |
| Flashcards and spaced repetition | Implemented |
| Local storage with IndexedDB | Implemented |
| PWA and offline support | Implemented |
| Supabase authentication | Implemented |
| PostgreSQL database schema | Created |
| Go backend API | In development |
| Backend database integration | Planned |
| Cloud synchronization | Planned |
| Multi-device synchronization | Planned |

Flashcards and review data are currently stored locally in the browser. Cloud synchronization has not yet been implemented.

## Technology Stack

**Frontend**
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Dexie and IndexedDB
- vite-plugin-pwa and Workbox

**Backend**
- Go
- REST API (in development)

**Database and Authentication**
- Supabase Auth
- Supabase PostgreSQL

**Deployment and Infrastructure**
- GitHub Pages
- Docker
- Kubernetes and Helm (development environment)

## Project Structure

```text
Meoini/
├── backend/
│   ├── cmd/api/
│   ├── docs/
│   └── internal/
│       ├── config/
│       ├── handler/
│       ├── middleware/
│       ├── model/
│       ├── repository/
│       └── service/
├── docs/
│   ├── database-design.md
│   ├── database-erd.md
│   ├── database-schema.sql
│   ├── openapi.yaml
│   └── migration-plan.md
├── helm/
│   └── meoini/
├── src/
├── Dockerfile
└── README.md
```

## Application Routes

| Route | Description |
|---|---|
| `/` | Dictionary and vocabulary lookup |
| `/review` | Review flashcards |
| `/library` | Saved vocabulary |
| `/settings` | Application settings |

## Getting Started

### Prerequisites

- Node.js 24
- npm
- Go 1.22 or later (for backend development)

### Frontend

Clone the repository:

```bash
git clone git@github.com:Xin5818/Meoini.git
cd Meoini
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

### Backend

Navigate to the backend directory:

```bash
cd backend
```

Start the Go server:

```bash
go run ./cmd/api
```

The backend runs on port `8082` by default.

Health check:

```bash
curl http://localhost:8082/health
```

Expected response:

```json
{"status":"ok"}
```

The backend currently provides an initial HTTP server and health check endpoint. API endpoints and database integration are still under development.

## Environment Configuration

The frontend uses the following environment variables for Supabase authentication:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Keep private credentials and secret keys out of the repository.

## Deployment

The frontend is deployed to GitHub Pages:

https://xin5818.github.io/meoini/

GitHub Actions builds and deploys the frontend.

The Go backend is a separate service and requires its own hosting environment. It is not hosted by GitHub Pages.

Docker and Kubernetes are used during backend and deployment development.

## Documentation

Detailed technical documentation is available in the [`docs/`](docs/) directory:

- `database-design.md`: Database design.
- `database-erd.md`: Entity relationship diagram.
- `database-schema.sql`: Database schema.
- `openapi.yaml`: API specification.
- `migration-plan.md`: Local data migration and synchronization plan.

## Roadmap

- [x] Build the dictionary and vocabulary learning frontend.
- [x] Implement local flashcards and spaced repetition.
- [x] Add offline support.
- [x] Integrate Supabase authentication.
- [x] Create the PostgreSQL database schema.
- [x] Initialize the Go backend.
- [ ] Implement backend API endpoints.
- [ ] Connect the backend to PostgreSQL.
- [ ] Implement JWT authentication and authorization.
- [ ] Integrate frontend APIs.
- [ ] Implement cloud synchronization and data migration.
- [ ] Complete containerized deployment and testing.
