# Changelog

All notable changes to the **Doc Upload Extraction** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-02-15

### Added

#### Document Upload & Extraction
- Multi-format document upload supporting PDF, CSV, XML, XLSX, XLS, DOCX, KML, and TXT file types.
- Drag-and-drop file upload interface with client-side validation for file type and size (max 10MB).
- Automatic text and data extraction with a 30-second SLA timeout per document.
- Dedicated extraction engines for each supported file format:
  - **PDF**: Full text extraction with page count and document metadata via `pdf-parse`.
  - **CSV**: Tabular data parsing with header detection and row/column counts via `csv-parse`.
  - **XLSX/XLS**: Multi-sheet spreadsheet extraction with per-sheet table data via `xlsx`.
  - **DOCX**: Raw text and HTML extraction with warning capture via `mammoth`.
  - **KML/XML**: Geospatial placemark extraction with coordinate parsing, geometry type detection, and folder traversal via `fast-xml-parser`.
  - **TXT**: Plain text extraction with BOM detection, encoding handling, and binary content rejection.
- Extraction result persistence with extracted text, tables, metadata, and geospatial data stored as JSONB in PostgreSQL.

#### Atlas Layer Visualization
- Interactive Atlas View page for visualizing geospatial data extracted from KML/XML files.
- SVG-based map rendering with coordinate projection, grid lines, and dynamic bounds calculation.
- Support for Point, LineString, Polygon, and MultiGeometry visualization with color-coded geometry types.
- Site selection with detailed coordinate table, description, and style URL display.
- Search and geometry type filtering for placemarks.
- GeoJSON export of filtered geospatial data.
- Aggregation of geospatial data across multiple uploaded source files.

#### Health Check Directory
- Health Check Directory page for viewing eNodeB status from extracted tabular data (CSV, XLSX, XLS).
- Automatic eNodeB field detection from table headers (enodeb, enb, site, cell, node, status, health, alarm).
- Health status inference from status fields and alarm counts (Healthy, Warning, Critical, Unknown).
- File sidebar for selecting between multiple health check source files.
- Summary statistics cards showing total eNodeBs, healthy, warning, and critical counts with health rate percentage.
- List and table view modes with search, status filtering, and CSV export.
- Detail panel for individual eNodeB field inspection.

#### Authentication & Session Management
- JWT-based authentication with short-lived access tokens (15m) and long-lived refresh tokens (7d).
- Login, logout, and token refresh API endpoints with input validation via `express-validator`.
- Server-side session management with refresh token storage in PostgreSQL.
- Automatic token refresh on 401 responses with request queuing during refresh.
- Protected route component with loading state and redirect to login.
- Client-side auth context with session check on app initialization.

#### Real-Time Upload Progress
- In-memory progress tracking with `ProgressNotifier` service for upload and extraction status.
- Animated progress bar component with status-specific colors, shimmer effect, and percentage display.
- Upload status list with summary counts, filter tabs, and per-file progress tracking.
- Background extraction processing with progress notifications at key stages (0%, 10%, 20%, 80%, 100%).
- Polling-based status updates from client with configurable interval and max attempts.
- Automatic cleanup of completed progress entries with configurable TTL.

#### Error Handling
- Centralized `AppError` class with operational error distinction and HTTP status codes.
- Global Express error handler with PostgreSQL constraint violation mapping (unique, foreign key).
- Multer file size and type error handling with user-friendly messages.
- Per-extraction-engine error classes (`PdfExtractionError`, `CsvExtractionError`, etc.) with operational flag.
- Client-side `ErrorMessage` component with severity levels (error, warning, info), retry/dismiss actions, and compact mode.
- Comprehensive error constants for authentication, file upload, document, extraction, and general errors.

#### Audit Logging
- Buffered log ingestion service with configurable buffer size (50) and flush interval (5s).
- Circuit breaker pattern for database write failures with automatic reset after 60 seconds.
- Event type classification: UPLOAD, VALIDATION, EXTRACTION, ERROR, AUTH, SYSTEM.
- Audit log query API with filtering by user, action, status, IP address, and date range.
- Paginated audit log table component with date range, action, and status filters.
- CSV and JSON export of filtered audit logs.
- Log detail panel with event metadata and JSON details display.
- Compliance manager with retention policy enforcement and compliance report generation.
- Request-level audit middleware capturing method, path, status code, response time, and user agent.

#### System Monitoring
- Health check endpoint reporting database connectivity, latency, uptime, and memory usage.
- Metrics endpoint with request counts by method/status, error counts by type, and extraction performance statistics (avg, min, max, P50, P95, P99).
- Prometheus-compatible text format metrics output.
- System Health Panel component with auto-refresh (30s default), database status, memory usage bar, request metrics, extraction performance, error breakdown, and log ingestion status.
- Admin-only access control for monitoring and audit log endpoints.

#### Frontend Architecture
- React 18 with Vite build tooling and HMR development server.
- Context-based state management for authentication (`AuthContext`) and uploads (`UploadContext`).
- Responsive layout with collapsible sidebar, sticky header, and mobile menu overlay.
- Centralized theme configuration with design tokens for colors, typography, spacing, shadows, and component styles.
- Reusable component library: `DataTable`, `LoadingSpinner`, `ErrorMessage`, `ProgressBar`, `FileDropzone`.
- Page-level components: Dashboard, Upload, Atlas, Health Check, Extraction Result, Audit, Monitoring, Login, Not Found.
- API client with automatic token injection, 401 retry with refresh, and error formatting.

#### Backend Architecture
- Express.js REST API with modular route, service, and repository layers.
- PostgreSQL database with UUID primary keys, JSONB columns, and automatic `updated_at` triggers.
- Repository pattern for Users, Sessions, Document Uploads, Extraction Results, and Audit Logs.
- Rate limiting (100 requests per 15 minutes) with `express-rate-limit`.
- Security headers via `helmet` and CORS configuration with configurable allowed origins.
- Structured JSON logging with configurable log levels (error, warn, info, debug).
- Environment-based configuration via `.env` with sensible defaults.

### Security
- Password hashing with `bcryptjs` for user credential storage.
- JWT token signing with configurable secret and issuer validation.
- Refresh token rotation with database-backed session invalidation.
- Input validation and sanitization on all API endpoints.
- SQL injection prevention through parameterized queries.
- File type validation on both MIME type and file extension.
- Admin role enforcement for audit log and monitoring access.

[1.0.0]: https://github.com/doc-upload-extraction/releases/tag/v1.0.0