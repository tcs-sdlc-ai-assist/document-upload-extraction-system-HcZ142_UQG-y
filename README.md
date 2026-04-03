# Doc Upload Extraction

A full-stack document upload and extraction application built with React (Vite) and Node.js/Express. Upload multi-format documents, automatically extract text, tables, metadata, and geospatial data, then visualize results through an interactive Atlas map view and Health Check directory.

## Tech Stack

### Frontend
- **React 18** with Vite build tooling and HMR
- **React Router v6** for client-side routing
- **Context API** for state management (AuthContext, UploadContext)
- **Inline styles** with centralized theme configuration

### Backend
- **Node.js / Express** REST API
- **PostgreSQL** with `pg` driver (UUID primary keys, JSONB columns)
- **JWT** authentication with refresh token rotation
- **Multer** for file upload handling (memory storage)

### Key Libraries
- `pdf-parse` — PDF text extraction
- `csv-parse` — CSV parsing
- `xlsx` — XLSX/XLS spreadsheet extraction
- `mammoth` — DOCX text and HTML extraction
- `fast-xml-parser` — KML/XML geospatial data extraction
- `bcryptjs` — Password hashing
- `jsonwebtoken` — JWT token management
- `helmet` — Security headers
- `express-rate-limit` — Rate limiting
- `express-validator` — Input validation

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 13
- **npm** or **yarn**

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd doc-upload-extraction
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and update values for your local setup:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/doc_upload_extraction

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# File Upload
MAX_FILE_SIZE_MB=10

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001

# Application
NODE_ENV=development
PORT=3001

# Logging
LOG_LEVEL=debug
```

> **Important:** Change `JWT_SECRET` to a strong, unique value in production environments.

### 4. Set Up the Database

Create the PostgreSQL database:

```bash
createdb doc_upload_extraction
```

Run the schema migration:

```bash
psql -d doc_upload_extraction -f schema.sql
```

Or use the migration script:

```bash
npm run db:migrate
```

Optionally seed the database with initial data:

```bash
npm run db:seed
```

### 5. Start the Development Server

Run both the frontend and backend concurrently:

```bash
npm run dev
```

This starts:
- **Frontend** (Vite) at `http://localhost:5173`
- **Backend** (Express) at `http://localhost:3001`

To run them individually:

```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

### 6. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
doc-upload-extraction/
├── api/                          # Backend API
│   ├── config/
│   │   ├── constants.js          # Application constants and error messages
│   │   ├── db.js                 # PostgreSQL connection pool
│   │   └── uploadConfig.js       # Multer upload configuration
│   ├── engines/
│   │   ├── CsvExtractionEngine.js
│   │   ├── DocxExtractionEngine.js
│   │   ├── KmlExtractionEngine.js
│   │   ├── PdfExtractionEngine.js
│   │   ├── TxtExtractionEngine.js
│   │   └── XlsExtractionEngine.js
│   ├── middleware/
│   │   ├── auditMiddleware.js    # Request audit logging
│   │   ├── authMiddleware.js     # JWT authentication
│   │   └── errorHandler.js       # Global error handling
│   ├── repositories/
│   │   ├── AuditLogRepository.js
│   │   ├── DocumentUploadRepository.js
│   │   ├── ExtractionResultRepository.js
│   │   ├── SessionRepository.js
│   │   └── UserRepository.js
│   ├── routes/
│   │   ├── authRoutes.js         # Authentication endpoints
│   │   ├── documentRoutes.js     # Document upload/extraction endpoints
│   │   ├── logRoutes.js          # Audit log endpoints
│   │   └── monitoringRoutes.js   # Health check and metrics endpoints
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── ComplianceManager.js
│   │   ├── DocumentUploadService.js
│   │   ├── ExtractionEngineFactory.js
│   │   ├── LogIngestionService.js
│   │   ├── MonitoringService.js
│   │   ├── ProgressNotifier.js
│   │   ├── SessionManager.js
│   │   └── TokenManager.js
│   ├── utils/
│   │   └── logger.js             # Structured JSON logger
│   └── index.js                  # Express app entry point
├── src/                          # Frontend React application
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── common/
│   │   │   ├── DataTable.jsx
│   │   │   ├── ErrorMessage.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   ├── extraction/
│   │   │   ├── AtlasView.jsx
│   │   │   ├── ExtractionResultView.jsx
│   │   │   └── HealthCheckDirectory.jsx
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Layout.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── monitoring/
│   │   │   ├── AuditLogTable.jsx
│   │   │   └── SystemHealthPanel.jsx
│   │   └── upload/
│   │       ├── FileDropzone.jsx
│   │       ├── ProgressBar.jsx
│   │       └── UploadStatusList.jsx
│   ├── config/
│   │   └── theme.js              # Design tokens and component styles
│   ├── context/
│   │   ├── AuthContext.jsx        # Authentication state management
│   │   └── UploadContext.jsx      # Upload queue and results state
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useUpload.js
│   ├── pages/
│   │   ├── AtlasPage.jsx
│   │   ├── AuditPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── ExtractionResultPage.jsx
│   │   ├── HealthCheckPage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── MonitoringPage.jsx
│   │   ├── NotFoundPage.jsx
│   │   └── UploadPage.jsx
│   ├── services/
│   │   ├── apiClient.js          # HTTP client with token refresh
│   │   ├── authService.js
│   │   ├── documentService.js
│   │   └── logService.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── schema.sql                    # Database schema definition
├── .env.example                  # Environment variable template
├── package.json
├── vite.config.js
├── vercel.json
└── README.md
```

## API Endpoint Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/login` | Authenticate user and receive tokens | No |
| `POST` | `/api/auth/logout` | Invalidate refresh token | No |
| `POST` | `/api/auth/refresh` | Refresh access token | No |
| `GET` | `/api/auth/session` | Check current session status | Yes |

### Documents

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/documents/upload` | Upload a document for extraction | Yes |
| `GET` | `/api/documents/status/:uploadId` | Get upload and extraction status | Yes |
| `GET` | `/api/documents/result/:uploadId` | Get extraction results | Yes |
| `GET` | `/api/documents/list` | List uploads with filtering and pagination | Yes |
| `GET` | `/api/documents/stats` | Get upload statistics | Yes |
| `DELETE` | `/api/documents/:uploadId` | Delete a document and its results | Yes |

#### Document List Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `processing`, `completed`, `failed` |
| `filetype` | string | Filter by file type |
| `start_date` | ISO8601 | Filter uploads created after this date |
| `end_date` | ISO8601 | Filter uploads created before this date |
| `page` | integer | Page number (default: 1) |
| `page_size` | integer | Results per page (default: 50, max: 500) |
| `sort_by` | string | Sort field: `created_at`, `updated_at`, `filename`, `filetype`, `size`, `status` |
| `sort_order` | string | Sort direction: `ASC` or `DESC` |

### Audit Logs (Admin Only)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/logs/event` | Ingest a log event | Yes |
| `GET` | `/api/logs/audit` | Query audit logs with filters | Admin |
| `GET` | `/api/logs/audit/export` | Export audit logs as JSON or CSV | Admin |
| `GET` | `/api/logs/audit/:id` | Get audit log detail by ID | Admin |

### Monitoring (Admin Only)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/monitoring/health` | System health check (DB, memory, uptime) | No |
| `GET` | `/api/monitoring/metrics` | Application metrics (JSON or Prometheus format) | Admin |

## Supported File Formats

| Format | Extension | MIME Type | Extraction Capabilities |
|--------|-----------|-----------|------------------------|
| **PDF** | `.pdf` | `application/pdf` | Full text extraction, page count, document metadata (title, author, dates) |
| **CSV** | `.csv` | `text/csv` | Tabular data parsing with header detection, row/column counts |
| **XLSX** | `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Multi-sheet extraction with per-sheet table data |
| **XLS** | `.xls` | `application/vnd.ms-excel` | Multi-sheet extraction with per-sheet table data |
| **DOCX** | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Raw text and HTML extraction with warning capture |
| **KML** | `.kml` | `application/vnd.google-earth.kml+xml` | Geospatial placemark extraction with coordinates, geometry types, folder traversal |
| **XML** | `.xml` | `application/xml`, `text/xml` | Parsed as KML for geospatial data extraction |
| **TXT** | `.txt` | `text/plain` | Plain text extraction with BOM detection and encoding handling |

**Maximum file size:** 10 MB (configurable via `MAX_FILE_SIZE_MB`)

**Extraction SLA timeout:** 30 seconds per document

## Usage Guide

### Uploading Documents

1. Navigate to the **Upload** page or use the **Quick Upload** on the Dashboard.
2. Drag and drop files onto the dropzone, or click to browse.
3. The application validates file type and size before uploading.
4. Once uploaded, extraction begins automatically in the background.
5. Track progress via the animated progress bar and status indicators.

### Viewing Extraction Results

1. After extraction completes, click on a completed upload to view results.
2. Results are organized into tabs: **Extracted Text**, **Data Tables**, **HTML Preview**, **Geospatial Data**, and **Metadata**.
3. Copy content to clipboard or download as TXT, CSV, or JSON.

### Atlas View (Geospatial Visualization)

1. Navigate to the **Atlas View** page.
2. All geospatial data from KML/XML uploads is aggregated and displayed on an SVG map.
3. Filter by geometry type (Point, LineString, Polygon, MultiGeometry) or search by site name.
4. Click on a site to view detailed coordinates, description, and style information.
5. Export filtered data as GeoJSON.

### Health Check Directory

1. Navigate to the **Health Check** page.
2. Tabular data from CSV, XLSX, and XLS uploads is analyzed for eNodeB health information.
3. The system automatically detects eNodeB fields and infers health status (Healthy, Warning, Critical, Unknown).
4. Filter by status, search by name or ID, and switch between list and table views.
5. Export filtered eNodeB data as CSV.

### Audit Logs (Admin)

1. Navigate to the **Audit Logs** page (requires admin role).
2. Filter logs by date range, action type, status, user ID, or IP address.
3. Click on a log entry to view full event details.
4. Export filtered logs as CSV or JSON.

### System Monitoring (Admin)

1. Navigate to the **Monitoring** page (requires admin role).
2. View real-time system health: database connectivity, memory usage, uptime.
3. Review request metrics, extraction performance (avg, P50, P95, P99), and error breakdowns.
4. Auto-refresh is enabled by default (every 30 seconds) and can be paused.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express server with nodemon |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview production build |
| `npm start` | Start production server |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint source files |
| `npm run lint:fix` | Lint and auto-fix source files |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with initial data |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | Secret key for signing JWT tokens |
| `JWT_EXPIRY` | `15m` | Access token expiration |
| `REFRESH_TOKEN_EXPIRY` | `7d` | Refresh token expiration |
| `MAX_FILE_SIZE_MB` | `10` | Maximum upload file size in megabytes |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3001` | Comma-separated CORS origins |
| `NODE_ENV` | `development` | Application environment |
| `PORT` | `3001` | Backend server port |
| `LOG_LEVEL` | `debug` | Logging level: `error`, `warn`, `info`, `debug` |
| `LOG_RETENTION_DAYS` | `365` | Audit log retention period in days |
| `LOG_BUFFER_SIZE` | `50` | Audit log buffer size before flush |
| `LOG_FLUSH_INTERVAL_MS` | `5000` | Audit log flush interval in milliseconds |
| `PROGRESS_TTL_MS` | `300000` | Progress entry TTL (5 minutes) |
| `PROGRESS_CLEANUP_INTERVAL_MS` | `60000` | Progress cleanup interval (1 minute) |

## Security

- Passwords are hashed with `bcryptjs` (salt rounds: 10).
- JWT access tokens are short-lived (15 minutes) with refresh token rotation.
- Refresh tokens are stored server-side in PostgreSQL with expiration enforcement.
- All API inputs are validated and sanitized via `express-validator`.
- SQL injection is prevented through parameterized queries.
- File uploads are validated on both MIME type and file extension.
- Rate limiting is applied at 100 requests per 15-minute window.
- Security headers are set via `helmet`.
- Admin role enforcement protects audit log and monitoring endpoints.

## License

This project is **private and proprietary**. All rights reserved. Unauthorized copying, distribution, or modification of this software is strictly prohibited without prior written permission from the project owner.