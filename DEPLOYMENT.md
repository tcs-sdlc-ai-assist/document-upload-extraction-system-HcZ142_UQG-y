# Deployment Guide

Comprehensive deployment documentation for the **Doc Upload Extraction** application covering Vercel deployment, environment configuration, database setup, CI/CD pipelines, environment strategy, and monitoring.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [PostgreSQL Database Setup](#postgresql-database-setup)
  - [Local Development](#local-development)
  - [Production Database (Managed)](#production-database-managed)
  - [Running Migrations](#running-migrations)
  - [Seeding Initial Data](#seeding-initial-data)
- [Environment Variable Configuration](#environment-variable-configuration)
  - [Required Variables](#required-variables)
  - [Optional Variables](#optional-variables)
  - [Environment-Specific Values](#environment-specific-values)
- [Vercel Deployment](#vercel-deployment)
  - [Initial Setup](#initial-setup)
  - [Project Configuration](#project-configuration)
  - [Environment Variables on Vercel](#environment-variables-on-vercel)
  - [Build and Output Settings](#build-and-output-settings)
  - [Deploying](#deploying)
- [Preview and Production Environment Strategy](#preview-and-production-environment-strategy)
  - [Branch Strategy](#branch-strategy)
  - [Preview Deployments](#preview-deployments)
  - [Production Deployments](#production-deployments)
  - [Environment Isolation](#environment-isolation)
- [CI/CD Pipeline](#cicd-pipeline)
  - [GitHub Actions Workflow](#github-actions-workflow)
  - [Pipeline Stages](#pipeline-stages)
  - [Secrets Management](#secrets-management)
- [Monitoring Setup](#monitoring-setup)
  - [Health Check Endpoint](#health-check-endpoint)
  - [Metrics Endpoint](#metrics-endpoint)
  - [Prometheus Integration](#prometheus-integration)
  - [Uptime Monitoring](#uptime-monitoring)
  - [Log Monitoring](#log-monitoring)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have the following:

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 13 (managed instance recommended for production)
- **Vercel CLI** installed globally (`npm i -g vercel`)
- **Git** repository connected to Vercel
- A Vercel account with the project imported
- Access to a PostgreSQL provider (e.g., Neon, Supabase, Railway, AWS RDS, or DigitalOcean Managed Databases)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     Vercel Edge                      │
│                                                     │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │  Static SPA  │         │  Serverless Function │  │
│  │  (React/Vite)│         │  (Express API)       │  │
│  │  dist/       │         │  api/index.js        │  │
│  └──────┬───────┘         └──────────┬───────────┘  │
│         │                            │              │
└─────────┼────────────────────────────┼──────────────┘
          │                            │
          │  /api/* routes             │
          │  proxied to serverless fn  │
          │                            │
          │                   ┌────────▼────────┐
          │                   │   PostgreSQL     │
          │                   │   (Managed)      │
          │                   │                  │
          │                   │  - users         │
          │                   │  - sessions      │
          │                   │  - document_     │
          │                   │    uploads       │
          │                   │  - extraction_   │
          │                   │    results       │
          │                   │  - audit_logs    │
          │                   └─────────────────┘
          │
     ┌────▼────┐
     │ Browser │
     │ Client  │
     └─────────┘
```

- **Frontend**: Vite-built React SPA served as static assets from `dist/`.
- **Backend**: Express.js API deployed as a Vercel Serverless Function via `api/index.js`.
- **Database**: External managed PostgreSQL instance connected via `DATABASE_URL`.
- **Routing**: `vercel.json` routes `/api/*` to the serverless function and all other paths to the SPA.

---

## PostgreSQL Database Setup

### Local Development

1. **Install PostgreSQL** (if not already installed):

   ```bash
   # macOS (Homebrew)
   brew install postgresql@15
   brew services start postgresql@15

   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create the database**:

   ```bash
   createdb doc_upload_extraction
   ```

3. **Run the schema migration**:

   ```bash
   psql -d doc_upload_extraction -f schema.sql
   ```

4. **Verify the schema**:

   ```bash
   psql -d doc_upload_extraction -c "\dt"
   ```

   You should see tables: `users`, `sessions`, `document_uploads`, `extraction_results`, `audit_logs`.

5. **Set the connection string** in `.env`:

   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/doc_upload_extraction
   ```

### Production Database (Managed)

For production, use a managed PostgreSQL provider. Recommended options:

| Provider | Free Tier | SSL | Connection Pooling | Notes |
|----------|-----------|-----|-------------------|-------|
| **Neon** | Yes (0.5 GB) | Yes | Built-in | Serverless-friendly, branching support |
| **Supabase** | Yes (500 MB) | Yes | PgBouncer | Includes auth and realtime features |
| **Railway** | Trial credits | Yes | No (use PgBouncer) | Simple setup, auto-provisioning |
| **AWS RDS** | Free tier (12 months) | Yes | No (use RDS Proxy) | Enterprise-grade, VPC support |
| **DigitalOcean** | No | Yes | Built-in | Managed backups, trusted sources |

**Setup steps** (using Neon as an example):

1. Create a new project at [neon.tech](https://neon.tech).
2. Create a database named `doc_upload_extraction`.
3. Copy the connection string (it will look like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/doc_upload_extraction?sslmode=require`).
4. Run the schema migration against the remote database:

   ```bash
   psql "postgresql://user:pass@ep-xxx.region.aws.neon.tech/doc_upload_extraction?sslmode=require" -f schema.sql
   ```

5. Set the `DATABASE_URL` environment variable in Vercel (see below).

> **Important**: Always use SSL (`?sslmode=require`) for production database connections. The application automatically enables SSL when `NODE_ENV=production` (see `api/config/db.js`).

### Running Migrations

```bash
# Using the npm script (reads DATABASE_URL from .env)
npm run db:migrate

# Or directly with psql
psql -d doc_upload_extraction -f schema.sql

# Against a remote database
psql "$DATABASE_URL" -f schema.sql
```

### Seeding Initial Data

Seed the database with an initial admin user and sample data:

```bash
# Using the npm script
npm run db:seed

# This creates:
# - Admin user (username: admin, role: admin)
# - Sample user (username: user, role: user)
```

> **Important**: Change default passwords immediately after seeding in production environments.

---

## Environment Variable Configuration

### Required Variables

These variables **must** be set for the application to function:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname?sslmode=require` |
| `JWT_SECRET` | Secret key for signing JWT access tokens. **Must be unique and strong in production.** | `a1b2c3d4e5f6...` (min 32 characters recommended) |

### Optional Variables

These variables have sensible defaults but can be overridden:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRY` | `15m` | Access token expiration duration |
| `REFRESH_TOKEN_EXPIRY` | `7d` | Refresh token expiration duration |
| `MAX_FILE_SIZE_MB` | `10` | Maximum upload file size in megabytes |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3001` | Comma-separated CORS allowed origins |
| `NODE_ENV` | `development` | Application environment (`development`, `production`) |
| `PORT` | `3001` | Backend server port (local development only) |
| `LOG_LEVEL` | `debug` | Logging level: `error`, `warn`, `info`, `debug` |
| `LOG_RETENTION_DAYS` | `365` | Audit log retention period in days |
| `LOG_BUFFER_SIZE` | `50` | Audit log buffer size before flush |
| `LOG_FLUSH_INTERVAL_MS` | `5000` | Audit log flush interval in milliseconds |
| `PROGRESS_TTL_MS` | `300000` | Progress entry TTL (5 minutes) |
| `PROGRESS_CLEANUP_INTERVAL_MS` | `60000` | Progress cleanup interval (1 minute) |

### Environment-Specific Values

#### Development (`.env`)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/doc_upload_extraction
JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
MAX_FILE_SIZE_MB=10
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
```

#### Preview / Staging

```env
DATABASE_URL=postgresql://user:pass@staging-host:5432/doc_upload_extraction_staging?sslmode=require
JWT_SECRET=preview-unique-secret-key-min-32-chars-long
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
MAX_FILE_SIZE_MB=10
ALLOWED_ORIGINS=https://doc-upload-extraction-preview.vercel.app
NODE_ENV=production
LOG_LEVEL=info
```

#### Production

```env
DATABASE_URL=postgresql://user:pass@production-host:5432/doc_upload_extraction?sslmode=require
JWT_SECRET=production-cryptographically-secure-random-string-64-chars
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
MAX_FILE_SIZE_MB=10
ALLOWED_ORIGINS=https://doc-upload-extraction.vercel.app,https://your-custom-domain.com
NODE_ENV=production
LOG_LEVEL=warn
```

> **Security Note**: Generate `JWT_SECRET` using a cryptographically secure method:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## Vercel Deployment

### Initial Setup

1. **Install the Vercel CLI**:

   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Link the project** (from the repository root):

   ```bash
   vercel link
   ```

   Follow the prompts to connect to your Vercel team and project.

### Project Configuration

The project uses `vercel.json` for routing and build configuration:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "vite.config.js",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/index.js"
    },
    {
      "src": "/(assets/.*)",
      "dest": "dist/$1"
    },
    {
      "src": "/(.*\\.(js|css|ico|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot))",
      "dest": "dist/$1"
    },
    {
      "src": "/(.*)",
      "dest": "dist/index.html"
    }
  ]
}
```

**Route breakdown**:

| Pattern | Destination | Purpose |
|---------|-------------|---------|
| `/api/*` | `server/index.js` | All API requests routed to Express serverless function |
| `/assets/*` | `dist/assets/*` | Vite-generated hashed static assets |
| `*.(js\|css\|ico\|...)` | `dist/*` | Other static files |
| `/*` | `dist/index.html` | SPA fallback for client-side routing |

### Environment Variables on Vercel

Set environment variables through the Vercel Dashboard or CLI:

**Via Vercel Dashboard**:

1. Navigate to your project on [vercel.com](https://vercel.com).
2. Go to **Settings** → **Environment Variables**.
3. Add each variable with the appropriate scope:

   | Variable | Production | Preview | Development |
   |----------|:----------:|:-------:|:-----------:|
   | `DATABASE_URL` | ✅ (production DB) | ✅ (staging DB) | ✅ (local DB) |
   | `JWT_SECRET` | ✅ (unique) | ✅ (unique) | ✅ |
   | `JWT_EXPIRY` | ✅ | ✅ | ✅ |
   | `REFRESH_TOKEN_EXPIRY` | ✅ | ✅ | ✅ |
   | `MAX_FILE_SIZE_MB` | ✅ | ✅ | ✅ |
   | `ALLOWED_ORIGINS` | ✅ (production URLs) | ✅ (preview URLs) | ✅ (localhost) |
   | `NODE_ENV` | `production` | `production` | `development` |
   | `LOG_LEVEL` | `warn` | `info` | `debug` |

**Via Vercel CLI**:

```bash
# Add a production environment variable
vercel env add DATABASE_URL production
# (paste the value when prompted)

# Add a preview environment variable
vercel env add DATABASE_URL preview

# Add to all environments
vercel env add JWT_SECRET production preview

# List all environment variables
vercel env ls

# Remove an environment variable
vercel env rm DATABASE_URL production
```

> **Important**: Use different `DATABASE_URL` and `JWT_SECRET` values for production and preview environments to maintain isolation.

### Build and Output Settings

If configuring through the Vercel Dashboard instead of `vercel.json`:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x |

### Deploying

**Production deployment** (from the `main` branch):

```bash
# Deploy to production
vercel --prod

# Or push to main branch (auto-deploys if connected)
git push origin main
```

**Preview deployment** (from any other branch):

```bash
# Deploy a preview
vercel

# Or push to a feature branch
git push origin feature/my-feature
```

**Verify the deployment**:

```bash
# Check deployment status
vercel ls

# View deployment logs
vercel logs <deployment-url>

# Open the deployment in browser
vercel open
```

---

## Preview and Production Environment Strategy

### Branch Strategy

```
main (production)
 │
 ├── develop (staging/integration)
 │    │
 │    ├── feature/upload-improvements
 │    ├── feature/atlas-enhancements
 │    └── fix/extraction-timeout
 │
 └── hotfix/critical-security-patch
```

| Branch | Environment | Auto-Deploy | Database | URL |
|--------|-------------|:-----------:|----------|-----|
| `main` | Production | ✅ | Production DB | `doc-upload-extraction.vercel.app` |
| `develop` | Staging | ✅ | Staging DB | `doc-upload-extraction-develop.vercel.app` |
| `feature/*` | Preview | ✅ | Staging DB | `doc-upload-extraction-<hash>.vercel.app` |
| `hotfix/*` | Preview | ✅ | Staging DB | `doc-upload-extraction-<hash>.vercel.app` |

### Preview Deployments

Every push to a non-production branch creates a unique preview deployment:

- **Unique URL**: Each preview gets a unique URL (e.g., `doc-upload-extraction-abc123.vercel.app`).
- **Shared staging database**: Preview deployments share the staging database to avoid provisioning overhead.
- **Environment variables**: Preview-scoped variables are used automatically.
- **PR comments**: Vercel posts the preview URL as a comment on pull requests.
- **Automatic cleanup**: Preview deployments are retained based on your Vercel plan limits.

**Best practices for preview environments**:

1. Use a separate staging database to prevent preview deployments from affecting production data.
2. Set `ALLOWED_ORIGINS` to include Vercel's preview URL patterns or use a wildcard for preview.
3. Use `LOG_LEVEL=info` for preview to capture useful debugging information without excessive noise.

### Production Deployments

Production deployments are triggered by:

1. **Merging to `main`**: Automatic deployment via Vercel Git integration.
2. **Manual promotion**: Promote a preview deployment to production via the Vercel Dashboard.
3. **CLI deployment**: `vercel --prod` from the repository root.

**Production deployment checklist**:

- [ ] All tests pass in CI pipeline
- [ ] Database migrations have been applied to production
- [ ] Environment variables are correctly set for production
- [ ] `JWT_SECRET` is unique and cryptographically secure
- [ ] `ALLOWED_ORIGINS` includes all production domains
- [ ] `NODE_ENV` is set to `production`
- [ ] `LOG_LEVEL` is set to `warn` or `error`
- [ ] CORS origins do not include localhost
- [ ] SSL is enabled on the database connection

### Environment Isolation

```
┌─────────────────────────────────────────────┐
│              Production Environment          │
│                                             │
│  Vercel (main branch)                       │
│  ├── DATABASE_URL → Production PostgreSQL   │
│  ├── JWT_SECRET → Unique production secret  │
│  ├── ALLOWED_ORIGINS → production domains   │
│  └── LOG_LEVEL → warn                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Preview Environment             │
│                                             │
│  Vercel (feature/develop branches)          │
│  ├── DATABASE_URL → Staging PostgreSQL      │
│  ├── JWT_SECRET → Unique preview secret     │
│  ├── ALLOWED_ORIGINS → preview domains      │
│  └── LOG_LEVEL → info                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│              Local Development               │
│                                             │
│  localhost:5173 (Vite) + localhost:3001 (API)│
│  ├── DATABASE_URL → Local PostgreSQL        │
│  ├── JWT_SECRET → Dev secret                │
│  ├── ALLOWED_ORIGINS → localhost            │
│  └── LOG_LEVEL → debug                      │
└─────────────────────────────────────────────┘
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: doc_upload_extraction_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: psql -h localhost -U postgres -d doc_upload_extraction_test -f schema.sql
        env:
          PGPASSWORD: postgres

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/doc_upload_extraction_test
          JWT_SECRET: test-secret-key-for-ci-pipeline
          NODE_ENV: test
          LOG_LEVEL: error

      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/doc_upload_extraction_test
          JWT_SECRET: test-secret-key-for-ci-pipeline
          NODE_ENV: test
          LOG_LEVEL: error

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Verify build output
        run: |
          test -d dist
          test -f dist/index.html
          echo "Build output verified successfully"

  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel (Preview)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-comment: true

  deploy-production:
    name: Deploy Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel (Production)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          github-token: ${{ secrets.GITHUB_TOKEN }}

  migrate-production:
    name: Migrate Production Database
    runs-on: ubuntu-latest
    needs: deploy-production
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Run production migrations
        run: psql "$DATABASE_URL" -f schema.sql
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

### Pipeline Stages

```
┌──────┐    ┌──────┐    ┌───────┐    ┌────────────┐    ┌────────────────┐
│ Lint │───▶│ Test │───▶│ Build │───▶│ Deploy     │───▶│ Post-Deploy    │
│      │    │      │    │       │    │ (Preview/  │    │ (Migrations,   │
│      │    │      │    │       │    │  Prod)     │    │  Verification) │
└──────┘    └──────┘    └───────┘    └────────────┘    └────────────────┘
```

| Stage | Trigger | Actions |
|-------|---------|---------|
| **Lint** | All pushes and PRs | ESLint checks on all `.js` and `.jsx` files |
| **Test** | After lint passes | Unit tests with PostgreSQL service container |
| **Build** | After tests pass | Vite production build, verify output |
| **Deploy Preview** | Pull requests | Deploy to Vercel preview, comment on PR |
| **Deploy Production** | Push to `main` | Deploy to Vercel production |
| **Migrate** | After production deploy | Apply schema migrations to production DB |

### Secrets Management

Configure the following secrets in your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

| Secret | Description | Where to Find |
|--------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization/team ID | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Vercel project ID | `.vercel/project.json` after `vercel link` |
| `PRODUCTION_DATABASE_URL` | Production PostgreSQL connection string | Your database provider dashboard |

> **Security Note**: Never commit secrets to the repository. Use GitHub Secrets for CI/CD and Vercel Environment Variables for runtime configuration.

---

## Monitoring Setup

### Health Check Endpoint

The application exposes a public health check endpoint:

```
GET /api/monitoring/health
```

**Response** (healthy):

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-02-15T10:30:00.000Z",
    "uptime": {
      "ms": 86400000,
      "seconds": 86400,
      "human": "1d 0h 0m 0s"
    },
    "database": {
      "connected": true,
      "latency_ms": 3
    },
    "memory": {
      "rss_mb": 85.5,
      "heap_total_mb": 45.2,
      "heap_used_mb": 32.1,
      "external_mb": 1.8
    }
  }
}
```

**Response** (unhealthy — returns HTTP 503):

```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "database": {
      "connected": false,
      "latency_ms": null,
      "error": "Connection refused"
    }
  }
}
```

**Usage for uptime monitoring**:

- Configure your monitoring service to poll `GET /api/monitoring/health` every 30–60 seconds.
- Alert when the response status code is not `200` or when `data.status` is not `"healthy"`.
- Monitor `data.database.latency_ms` for database performance degradation.

### Metrics Endpoint

The application exposes a metrics endpoint (admin-only, requires authentication):

```
GET /api/monitoring/metrics
Authorization: Bearer <admin-access-token>
```

**JSON response**:

```json
{
  "success": true,
  "data": {
    "timestamp": "2024-02-15T10:30:00.000Z",
    "uptime_seconds": 86400,
    "requests": {
      "total": 15420,
      "by_method": { "GET": 12000, "POST": 3200, "DELETE": 220 },
      "by_status": { "200": 14500, "201": 500, "400": 200, "401": 150, "500": 70 }
    },
    "errors": {
      "total": 70,
      "by_type": { "extraction_pdf": 30, "extraction_csv": 15, "500_POST_/api/documents/upload": 25 }
    },
    "extraction": {
      "count": 1250,
      "avg_ms": 2340,
      "min_ms": 120,
      "max_ms": 28500,
      "p50_ms": 1800,
      "p95_ms": 8500,
      "p99_ms": 22000
    },
    "log_ingestion": {
      "log_ingest_success_total": 45000,
      "log_ingest_failure_total": 12,
      "log_buffer_size": 3,
      "circuit_breaker_open": false,
      "consecutive_failures": 0
    },
    "memory": {
      "rss_mb": 85.5,
      "heap_total_mb": 45.2,
      "heap_used_mb": 32.1,
      "external_mb": 1.8
    }
  }
}
```

**Prometheus-compatible format** (request with `Accept: text/plain`):

```
GET /api/monitoring/metrics
Authorization: Bearer <admin-access-token>
Accept: text/plain
```

Returns Prometheus text format metrics suitable for scraping.

### Prometheus Integration

To integrate with Prometheus, add a scrape configuration:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'doc-upload-extraction'
    scheme: https
    metrics_path: '/api/monitoring/metrics'
    scrape_interval: 30s
    authorization:
      type: Bearer
      credentials: '<admin-access-token>'
    static_configs:
      - targets: ['doc-upload-extraction.vercel.app']
    headers:
      Accept: ['text/plain']
```

**Key metrics to monitor**:

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `uptime_seconds` | Gauge | Alert if resets unexpectedly |
| `request_count_total` | Counter | Monitor rate of change |
| `error_count_total` | Counter | Alert if > 10 errors/minute |
| `extraction_avg_ms` | Gauge | Alert if > 15000ms |
| `extraction_count` | Counter | Monitor throughput |
| `memory_heap_used_bytes` | Gauge | Alert if > 80% of heap total |
| `log_ingest_failure_total` | Counter | Alert if increasing |
| `circuit_breaker_open` | Gauge | Alert if value is 1 |

### Uptime Monitoring

Configure external uptime monitoring with any of these services:

**Recommended services**:

- [UptimeRobot](https://uptimerobot.com) (free tier: 50 monitors)
- [Better Uptime](https://betteruptime.com) (free tier: 10 monitors)
- [Pingdom](https://www.pingdom.com)
- [Vercel Analytics](https://vercel.com/analytics) (built-in)

**Configuration**:

| Setting | Value |
|---------|-------|
| **URL** | `https://doc-upload-extraction.vercel.app/api/monitoring/health` |
| **Method** | `GET` |
| **Check Interval** | 60 seconds |
| **Expected Status** | `200` |
| **Expected Body** | Contains `"healthy"` |
| **Alert Channels** | Email, Slack, PagerDuty |
| **Timeout** | 10 seconds |

### Log Monitoring

The application uses structured JSON logging. In production (`NODE_ENV=production`), all log entries are output as JSON:

```json
{"timestamp":"2024-02-15T10:30:00.000Z","level":"info","message":"Server started","port":3001,"environment":"production"}
```

**Vercel Logs**:

- View real-time logs in the Vercel Dashboard under **Deployments** → **Functions** → **Logs**.
- Use `vercel logs <deployment-url>` from the CLI.
- Vercel retains function logs for the duration specified by your plan.

**External log aggregation** (optional):

For persistent log storage and advanced querying, integrate with:

- **Vercel Log Drains**: Forward logs to Datadog, Axiom, or a custom HTTP endpoint.
- **Datadog**: Real-time log monitoring with alerting.
- **Axiom**: Serverless-friendly log aggregation with generous free tier.

To set up a Vercel Log Drain:

1. Go to your Vercel project **Settings** → **Log Drains**.
2. Add a new drain with your preferred provider.
3. Configure filters for `error` and `warn` level logs.

**Audit log monitoring**:

The application maintains an internal audit log system accessible at `GET /api/logs/audit` (admin-only). Key events to monitor:

- `extraction.fail` — Extraction failures
- `system.error` — System-level errors
- `user.login` with `status: failure` — Failed login attempts (potential brute force)

---

## Post-Deployment Verification

After each deployment, verify the following:

### Automated Checks

```bash
# 1. Health check
curl -s https://doc-upload-extraction.vercel.app/api/monitoring/health | jq '.data.status'
# Expected: "healthy"

# 2. Database connectivity
curl -s https://doc-upload-extraction.vercel.app/api/monitoring/health | jq '.data.database.connected'
# Expected: true

# 3. Authentication flow
curl -s -X POST https://doc-upload-extraction.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq '.success'
# Expected: true

# 4. Frontend loads
curl -s -o /dev/null -w "%{http_code}" https://doc-upload-extraction.vercel.app/
# Expected: 200

# 5. Static assets load
curl -s -o /dev/null -w "%{http_code}" https://doc-upload-extraction.vercel.app/assets/index-*.js
# Expected: 200
```

### Manual Checks

- [ ] Login page renders correctly
- [ ] Authentication works (login/logout)
- [ ] File upload functions (drag-and-drop and browse)
- [ ] Extraction completes for at least one file type (e.g., PDF)
- [ ] Dashboard displays upload statistics
- [ ] Atlas View renders geospatial data (if KML/XML files exist)
- [ ] Health Check Directory displays eNodeB data (if CSV/XLSX files exist)
- [ ] Audit Logs page loads (admin only)
- [ ] Monitoring page shows system health (admin only)

---

## Rollback Procedures

### Vercel Instant Rollback

Vercel supports instant rollback to any previous deployment:

**Via Dashboard**:

1. Go to your project on [vercel.com](https://vercel.com).
2. Navigate to **Deployments**.
3. Find the last known good deployment.
4. Click the three-dot menu (⋯) → **Promote to Production**.

**Via CLI**:

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```

### Database Rollback

If a migration causes issues:

1. **Identify the problem**: Check application logs and database state.
2. **Revert the migration**: Apply a reverse migration script or restore from backup.
3. **Restore from backup**: If using a managed database provider, restore from the latest automated backup.

> **Important**: The `schema.sql` file uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, making it safe to re-run. However, destructive schema changes should always have a corresponding rollback script.

### Emergency Procedures

1. **Application down**: Check Vercel status page, then check database connectivity via health endpoint.
2. **Database unreachable**: Verify database provider status, check connection string, verify SSL settings.
3. **Authentication broken**: Verify `JWT_SECRET` hasn't changed between deployments. If rotated, all existing sessions are invalidated.
4. **High error rate**: Check Vercel function logs, review recent deployments, rollback if necessary.

---

## Troubleshooting

### Common Deployment Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `500` on all API routes | Missing `DATABASE_URL` | Set `DATABASE_URL` in Vercel environment variables |
| `500` on login | Missing `JWT_SECRET` | Set `JWT_SECRET` in Vercel environment variables |
| CORS errors in browser | `ALLOWED_ORIGINS` mismatch | Update `ALLOWED_ORIGINS` to include the deployment URL |
| Database connection timeout | SSL not enabled | Append `?sslmode=require` to `DATABASE_URL` |
| Build fails | Node.js version mismatch | Ensure Node.js 18.x is configured in Vercel settings |
| `404` on API routes | `vercel.json` misconfigured | Verify `vercel.json` routes match the expected patterns |
| File upload fails | `MAX_FILE_SIZE_MB` too low | Increase `MAX_FILE_SIZE_MB` or check Vercel's 4.5MB serverless payload limit |
| Extraction timeout | File too large for serverless | Consider optimizing extraction or increasing `EXTRACTION_SLA_TIMEOUT_MS` |
| Refresh token invalid after deploy | `JWT_SECRET` changed | Users must re-authenticate; this is expected when rotating secrets |
| `relation "users" does not exist` | Migrations not applied | Run `psql "$DATABASE_URL" -f schema.sql` against the target database |

### Vercel Serverless Function Limits

Be aware of Vercel's serverless function limits:

| Limit | Free | Pro | Enterprise |
|-------|------|-----|-----------|
| **Execution Duration** | 10s | 60s | 900s |
| **Request Body Size** | 4.5 MB | 4.5 MB | 4.5 MB |
| **Response Body Size** | 4.5 MB | 4.5 MB | 4.5 MB |
| **Memory** | 1024 MB | 3008 MB | 3008 MB |
| **Concurrent Executions** | 10 | 1000 | Custom |

> **Note**: The 4.5 MB request body limit applies to file uploads. The application's default `MAX_FILE_SIZE_MB=10` may exceed this limit on Vercel's serverless functions. For files larger than 4.5 MB, consider implementing a streaming upload solution or using Vercel Blob Storage.

### Viewing Logs

```bash
# Real-time logs for the latest deployment
vercel logs --follow

# Logs for a specific deployment
vercel logs https://doc-upload-extraction-abc123.vercel.app

# Filter by function
vercel logs --filter "api/index.js"
```

### Database Debugging

```bash
# Test database connectivity
psql "$DATABASE_URL" -c "SELECT 1"

# Check table existence
psql "$DATABASE_URL" -c "\dt"

# Check row counts
psql "$DATABASE_URL" -c "SELECT 'users' as table_name, COUNT(*) FROM users UNION ALL SELECT 'document_uploads', COUNT(*) FROM document_uploads UNION ALL SELECT 'extraction_results', COUNT(*) FROM extraction_results UNION ALL SELECT 'sessions', COUNT(*) FROM sessions UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs"

# Check for expired sessions
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM sessions WHERE expires_at < NOW()"

# Purge expired sessions
psql "$DATABASE_URL" -c "DELETE FROM sessions WHERE expires_at < NOW()"
```

---

## Security Checklist for Production

Before going live, verify:

- [ ] `JWT_SECRET` is a cryptographically secure random string (≥ 32 characters)
- [ ] `JWT_SECRET` is unique per environment (production ≠ preview ≠ development)
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`)
- [ ] `NODE_ENV` is set to `production`
- [ ] `ALLOWED_ORIGINS` does not include `localhost` or development URLs
- [ ] `LOG_LEVEL` is set to `warn` or `error` (not `debug`)
- [ ] Default seed passwords have been changed
- [ ] Database access is restricted to the application's IP range (if supported by provider)
- [ ] Rate limiting is active (100 requests per 15-minute window)
- [ ] Security headers are enabled via `helmet`
- [ ] File upload validation is enforced (MIME type + extension + size)
- [ ] Admin endpoints (`/api/logs/audit`, `/api/monitoring/metrics`) require admin role