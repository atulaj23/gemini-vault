# Gemini Vault

> **"Your thoughts. Your AI. Your integrity."**

A **Privacy-First, Tamper-Evident Personal AI Journal** powered by Google Gemini, Firebase, and Cloud Run.

Built for the **Google GenAI Academy APAC / Cloud Run AI Challenge**.

---

## ✨ What makes Gemini Vault different

Most AI journals are just chat interfaces. Gemini Vault adds a genuinely unique feature:

### 🔗 Integrity Vault — Tamper-Evident Journal Entries

Every finalized journal entry is cryptographically locked into a **SHA-256 hash chain**, server-controlled and independently verifiable:

```
contentHash  = SHA256(canonicalized_content)
chainHash    = SHA256(previousHash | contentHash | uid | sequenceNumber | serverTimestamp)
```

- The **server controls** all chain inputs (clients cannot forge them)
- A Firestore transaction prevents concurrent chain forks
- The `/api/integrity/verify` endpoint recomputes every hash and detects the first broken link
- A visual **Tamper-Evident Verification Receipt** is shown in the UI

This is **not blockchain** and **not absolute immutability** — it is **tamper-evidence**: if any stored content is modified after finalization, the verification will detect which entry broke the chain and why (`CONTENT_HASH_MISMATCH`, `PREVIOUS_HASH_MISMATCH`, `CHAIN_HASH_MISMATCH`).

---

## 🏗️ Architecture

```
Browser (React + Firebase Auth)
        │
        │  Firebase ID Token (Bearer header)
        ↓
Cloud Run Backend (Express + TypeScript)
        │
        ├── Firebase Admin SDK → verifyIdToken() → UID
        ├── Firestore (user-isolated data)
        ├── Google Cloud Secret Manager → Gemini API key
        └── Gemini API (server-side only)
```

**Security boundary:** The browser NEVER talks to Gemini directly. The Gemini API key never leaves the backend. The UID always comes from the verified Firebase token — never from client input.

See [`docs/architecture.md`](docs/architecture.md) for full diagrams.

---

## 📦 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Auth | Firebase Authentication (Google Sign-In) |
| Backend | Node.js, TypeScript, Express |
| Database | Cloud Firestore |
| AI | Google Gemini API (`gemini-2.0-flash`) |
| Secrets | Google Cloud Secret Manager |
| Deployment | Docker, Google Cloud Run |
| Security | Firebase Admin SDK token verification, Zod validation, Helmet, rate limiting |

---

## 🔐 Security Model

- **Token verification:** Every protected endpoint verifies a Firebase ID token server-side
- **UID isolation:** UID is derived from the verified token only — never from client input
- **Firestore rules:** Users can only access their own data; integrity ledger is client-read-only
- **Secret Manager:** Gemini API key is stored in Secret Manager in production, never in code or Firestore
- **Input validation:** All user input is validated with Zod before processing
- **Rate limiting:** Global 100 req/15min, Gemini endpoint 20 req/min
- **No sensitive logging:** Journal content, tokens, and API keys are never logged
- **Production errors:** Stack traces and internal paths are never exposed to clients

See [`docs/threat-model.md`](docs/threat-model.md) for the full threat model.

---

## 🚀 Local Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Firebase project with Firestore and Authentication enabled
- Google Cloud project with Secret Manager API enabled
- Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/atulaj23/gemini-vault.git
cd gemini-vault
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Enable **Firestore Database** (start in production mode)
4. Enable **Authentication** → Sign-in method → **Google**
5. Add a **Web app** and copy the Firebase config
6. Go to **Project Settings → Service Accounts** and download a service account JSON key

### 3. Firestore Security Rules

Deploy the Firestore security rules:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools
firebase login

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 4. Google Cloud Secret Manager

Store the Gemini API key in Secret Manager:

```bash
# Enable the Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create the secret
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# Grant Cloud Run's service account access (do this after creating the Cloud Run service)
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 5. Backend Environment Variables

```bash
cd backend
cp ../.env.example .env
# Edit .env with your values:
#   FIREBASE_PROJECT_ID=your-project-id
#   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
#   GEMINI_API_KEY=your-gemini-api-key (dev only)
#   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
#   FRONTEND_URL=http://localhost:5173
```

### 6. Frontend Environment Variables

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your Firebase config values
```

### 7. Install and run

```bash
# From repo root
npm install  # installs all workspaces

# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

The frontend will be at `http://localhost:5173` and the backend at `http://localhost:8080`.

---

## 🧪 Testing

```bash
# Run backend tests
npm run test:backend

# The test suite covers:
# - Unauthenticated request rejection
# - Invalid Firebase token rejection
# - Authenticated user access
# - Client-supplied UID override prevention
# - Content hash tamper detection
# - Chain hash linkage verification
# - Invalid payload rejection
# - Oversized request rejection
# - Health endpoint
# - Safe error responses
```

---

## ☁️ Cloud Run Deployment

### Build and deploy

```bash
# Build the Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/gemini-vault-backend .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT_ID/gemini-vault-backend

# Deploy to Cloud Run (with required challenge label)
gcloud run deploy gemini-vault-backend \
  --image gcr.io/YOUR_PROJECT_ID/gemini-vault-backend \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_PROJECT_ID,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID" \
  --labels "dev-tutorial=cloud-run-ai-challenge" \
  --min-instances 0 \
  --max-instances 10
```

> ⚠️ **Important:** The `dev-tutorial=cloud-run-ai-challenge` label is required for the challenge. It is included in the deployment command above.

### Environment Variables on Cloud Run

Set the following environment variables in the Cloud Run service:
- `FIREBASE_PROJECT_ID` — your Firebase project ID
- `GOOGLE_CLOUD_PROJECT` — your GCP project ID
- `NODE_ENV=production`
- `FRONTEND_URL` — your deployed frontend URL

The `GEMINI_API_KEY` is retrieved from Secret Manager automatically in production.

---

## 📁 Project Structure

```
gemini-vault/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Server entrypoint
│   │   ├── app.ts            # Express app factory
│   │   ├── config.ts         # Configuration
│   │   ├── middleware/       # Auth, error handling, logging
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Firebase, Gemini, Secret Manager, Integrity
│   │   ├── types/            # TypeScript models
│   │   └── utils/            # Crypto, validation, errors, logger
│   └── tests/
│       └── security.test.ts  # 25 security tests
├── frontend/
│   └── src/
│       ├── pages/            # Dashboard, Journal, Conversations, Integrity
│       ├── components/       # Layout, Sidebar, ProtectedRoute
│       ├── contexts/         # AuthContext
│       └── lib/              # Firebase client, API client
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── integrity-vault.md
│   ├── firestore-security-model.md
│   └── deployment.md
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Firestore indexes
├── firebase.json             # Firebase configuration
├── Dockerfile                # Multi-stage Docker build
├── .env.example              # Environment variable template
└── README.md
```

---

## 🔗 Integrity Vault — Technical Details

See [`docs/integrity-vault.md`](docs/integrity-vault.md) for the full technical explanation.

**Summary:**

1. User writes a journal entry (stored as a draft)
2. User clicks "Finalize & Add to Integrity Vault"
3. Backend, inside a Firestore transaction:
   - Reads the current chain tail atomically
   - Computes `contentHash = SHA256(canonicalize(content))`
   - Computes `chainHash = SHA256(previousHash | contentHash | uid | sequenceNumber | serverTimestamp)`
   - Writes the integrity ledger entry and marks the journal entry as finalized
4. User can click "Verify Integrity" to run the full chain verification
5. The Verification Receipt shows whether the chain is intact

---

## ⚠️ Limitations

- **Not legal proof:** This is tamper-evidence, not legal immutability. A database administrator with direct Firestore access could tamper with both the content and the ledger.
- **Single-user chain:** Each user has their own hash chain, scoped to their UID.
- **No blockchain:** This is a server-controlled hash chain, not a decentralized ledger.
- **Gemini model availability:** Subject to Google's API availability and rate limits.

---

## 🔮 Future Improvements

- [ ] Periodic automated integrity checks with email notifications
- [ ] Export integrity receipt as a signed PDF
- [ ] Multi-device sync with conflict resolution
- [ ] Journal search and filtering
- [ ] Mood/emotion tracking via AI analysis
- [ ] Tags autocomplete and management
- [ ] Data export (user-owned data portability)

---

## 📚 Documentation

- [Architecture](docs/architecture.md)
- [Threat Model](docs/threat-model.md)
- [Integrity Vault Deep Dive](docs/integrity-vault.md)
- [Firestore Security Model](docs/firestore-security-model.md)
- [Deployment Guide](docs/deployment.md)

---

*Built with ❤️ using Google Cloud · Firebase · Gemini · Cloud Run*
