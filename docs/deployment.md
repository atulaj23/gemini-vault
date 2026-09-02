# Deployment Guide

## Prerequisites

- Google Cloud project with billing enabled
- Firebase project linked to the GCP project
- `gcloud` CLI installed and authenticated
- Docker installed

## Step-by-Step Deployment

### 1. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com
```

### 2. Store the Gemini API key in Secret Manager

```bash
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
  --data-file=- \
  --replication-policy=automatic
```

### 3. Build and push the Docker image

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker REGION-docker.pkg.dev

# Create an Artifact Registry repository
gcloud artifacts repositories create gemini-vault \
  --repository-format=docker \
  --location=REGION

# Build the image
docker build -t REGION-docker.pkg.dev/PROJECT_ID/gemini-vault/backend:latest .

# Push
docker push REGION-docker.pkg.dev/PROJECT_ID/gemini-vault/backend:latest
```

### 4. Deploy to Cloud Run

```bash
gcloud run deploy gemini-vault-backend \
  --image REGION-docker.pkg.dev/PROJECT_ID/gemini-vault/backend:latest \
  --platform managed \
  --region REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "FIREBASE_PROJECT_ID=PROJECT_ID,GOOGLE_CLOUD_PROJECT=PROJECT_ID,NODE_ENV=production,FRONTEND_URL=https://YOUR_FRONTEND_URL" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
  --labels "dev-tutorial=cloud-run-ai-challenge" \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

> ⚠️ The `--labels "dev-tutorial=cloud-run-ai-challenge"` flag is required for the challenge.

### 5. Grant Secret Manager access

```bash
# Get the Cloud Run service account
SERVICE_ACCOUNT=$(gcloud run services describe gemini-vault-backend \
  --region REGION --format='value(spec.template.spec.serviceAccountName)')

# Grant Secret Manager access
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### 6. Verify deployment

```bash
# Get the service URL
URL=$(gcloud run services describe gemini-vault-backend \
  --region REGION --format='value(status.url)')

# Test health endpoint
curl "$URL/api/health"
```

Expected response:
```json
{
  "status": "healthy",
  "service": "gemini-vault-backend",
  "label": "dev-tutorial=cloud-run-ai-challenge"
}
```

### 7. Deploy frontend (Firebase Hosting)

```bash
cd frontend
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Update `FRONTEND_URL` in Cloud Run environment variables to point to your Firebase Hosting URL.

## Verify the Challenge Label

```bash
gcloud run services describe gemini-vault-backend \
  --region REGION \
  --format='value(metadata.labels)'
```

Should output: `dev-tutorial=cloud-run-ai-challenge`
