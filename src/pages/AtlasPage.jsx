import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import Layout from '../components/layout/Layout';
import AtlasView from '../components/extraction/AtlasView';
import ErrorMessage from '../components/common/ErrorMessage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import documentService from '../services/documentService';
import theme from '../config/theme';

const AtlasPage = () => {
  const { user } = useAuth();
  const { results, queue, uploads, getUploadsList, UPLOAD_STATES } = useUpload();

  const [serverUploads, setServerUploads] = useState([]);
  const [serverResults, setServerResults] = useState([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [uploadsError, setUploadsError] = useState(null);
  const [resultsError, setResultsError] = useState(null);

  const fetchCompletedUploads = useCallback(async () => {
    setIsLoadingUploads(true);
    setUploadsError(null);

    try {
      const response = await documentService.listUploads({
        status: 'completed',
        page: 1,
        page_size: 100,
        sort_by: 'created_at',
        sort_order: 'DESC',
      });

      if (response.success && response.data) {
        setServerUploads(response.data.uploads || []);
      } else {
        setUploadsError(response.message || 'Failed to load completed uploads.');
        setServerUploads([]);
      }
    } catch (err) {
      setUploadsError(err.message || 'An unexpected error occurred while loading uploads.');
      setServerUploads([]);
    } finally {
      setIsLoadingUploads(false);
    }
  }, []);

  const geospatialUploads = useMemo(() => {
    const geoTypes = ['kml', 'xml'];
    return serverUploads.filter((upload) => {
      const filetype = (upload.filetype || '').toLowerCase().trim();
      return geoTypes.includes(filetype);
    });
  }, [serverUploads]);

  const fetchGeospatialResults = useCallback(async () => {
    if (geospatialUploads.length === 0) {
      setServerResults([]);
      return;
    }

    setIsLoadingResults(true);
    setResultsError(null);

    const fetchedResults = [];

    for (const upload of geospatialUploads) {
      const uploadId = upload.upload_id || upload.id;
      if (!uploadId) continue;

      try {
        const response = await documentService.getExtractionResult(uploadId);

        if (response.success && response.data) {
          fetchedResults.push(response.data);
        }
      } catch {
        // Skip individual failures, continue fetching others
      }
    }

    if (fetchedResults.length === 0 && geospatialUploads.length > 0) {
      setResultsError('Failed to load geospatial extraction results. Please try again.');
    }

    setServerResults(fetchedResults);
    setIsLoadingResults(false);
  }, [geospatialUploads]);

  useEffect(() => {
    fetchCompletedUploads();
  }, [fetchCompletedUploads]);

  useEffect(() => {
    if (!isLoadingUploads && geospatialUploads.length > 0) {
      fetchGeospatialResults();
    }
  }, [isLoadingUploads, geospatialUploads.length, fetchGeospatialResults]);

  const allGeospatialData = useMemo(() => {
    const collected = [];

    // Collect from server results
    for (const result of serverResults) {
      if (result.geospatial_data && Array.isArray(result.geospatial_data)) {
        for (const item of result.geospatial_data) {
          collected.push({
            ...item,
            _sourceFileName: result.file_name || null,
            _sourceUploadId: result.upload_id || null,
          });
        }
      }
    }

    // Collect from context results (in-session uploads)
    if (results && queue) {
      for (const fileId of queue) {
        const result = results[fileId];
        if (result && result.geospatial_data && Array.isArray(result.geospatial_data)) {
          // Avoid duplicates by checking upload_id
          const alreadyIncluded = serverResults.some(
            (sr) => sr.upload_id && result.upload_id && sr.upload_id === result.upload_id
          );

          if (!alreadyIncluded) {
            const upload = uploads[fileId] || {};
            for (const item of result.geospatial_data) {
              collected.push({
                ...item,
                _sourceFileId: fileId,
                _sourceFileName: result.file_name || upload.file_name || null,
                _sourceUploadId: result.upload_id || null,
              });
            }
          }
        }
      }
    }

    return collected;
  }, [serverResults, results, queue, uploads]);

  const stats = useMemo(() => {
    const totalSites = allGeospatialData.length;
    const totalCoordinates = allGeospatialData.reduce(
      (sum, pm) => sum + (pm.coordinates ? pm.coordinates.length : 0),
      0
    );
    const sourceFiles = new Set();
    for (const item of allGeospatialData) {
      if (item._sourceFileName) {
        sourceFiles.add(item._sourceFileName);
      }
    }
    const geometryTypes = {};
    for (const item of allGeospatialData) {
      const type = item.geometry_type || 'Unknown';
      geometryTypes[type] = (geometryTypes[type] || 0) + 1;
    }

    return {
      totalSites,
      totalCoordinates,
      sourceFileCount: sourceFiles.size,
      geometryTypes,
    };
  }, [allGeospatialData]);

  const handleRetry = useCallback(() => {
    fetchCompletedUploads();
  }, [fetchCompletedUploads]);

  const handleDismissUploadsError = useCallback(() => {
    setUploadsError(null);
  }, []);

  const handleDismissResultsError = useCallback(() => {
    setResultsError(null);
  }, []);

  const handleRetryResults = useCallback(() => {
    fetchGeospatialResults();
  }, [fetchGeospatialResults]);

  const handleNavigate = useCallback((href) => {
    window.location.href = href;
  }, []);

  const isLoading = isLoadingUploads || isLoadingResults;

  const renderPageHeader = () => (
    <div style={{
      marginBottom: theme.spacing[6],
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: theme.spacing[3],
      }}>
        <div>
          <h1 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
            margin: 0,
            marginBottom: theme.spacing[1],
            lineHeight: theme.typography.lineHeight.tight,
          }}>
            Atlas View
          </h1>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Visualize cell sites and eNodeB locations from extracted geospatial data
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          flexWrap: 'wrap',
        }}>
          {/* Stats badges */}
          {!isLoading && allGeospatialData.length > 0 && (
            <>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.full,
                background: theme.colors.primary[50],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.primary[700],
              }}>
                {stats.totalSites} {stats.totalSites === 1 ? 'site' : 'sites'}
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                borderRadius: theme.borderRadius.full,
                background: theme.colors.neutral[100],
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
              }}>
                {stats.sourceFileCount} {stats.sourceFileCount === 1 ? 'source' : 'sources'}
              </span>
            </>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRetry}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              background: theme.components.button.secondary.background,
              color: isLoading ? theme.colors.text.disabled : theme.colors.text.secondary,
              border: theme.components.button.secondary.border,
              borderRadius: theme.components.button.secondary.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.components.button.secondary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: theme.transitions.default,
              whiteSpace: 'nowrap',
              opacity: isLoading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
                e.currentTarget.style.color = theme.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = theme.components.button.secondary.background;
                e.currentTarget.style.color = theme.colors.text.secondary;
              }
            }}
          >
            {isLoading && (
              <span style={{
                display: 'inline-block',
                width: '0.75rem',
                height: '0.75rem',
                border: `2px solid ${theme.colors.neutral[200]}`,
                borderTopColor: theme.colors.primary[600],
                borderRadius: '50%',
                animation: 'atlasPageSpin 0.8s linear infinite',
              }} />
            )}
            {isLoading ? 'Loading...' : '⟳ Refresh'}
          </button>

          {/* Upload button */}
          <button
            onClick={() => handleNavigate('/upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              background: theme.components.button.primary.background,
              color: theme.components.button.primary.color,
              border: 'none',
              borderRadius: theme.components.button.primary.borderRadius,
              padding: `${theme.components.button.primary.paddingY} ${theme.components.button.primary.paddingX}`,
              fontSize: theme.components.button.primary.fontSize,
              fontWeight: theme.components.button.primary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.background;
            }}
          >
            ↑ Upload KML/XML
          </button>
        </div>
      </div>
    </div>
  );

  const renderSourceFilesInfo = () => {
    if (isLoading || allGeospatialData.length === 0) return null;

    const sourceFiles = new Map();
    for (const item of allGeospatialData) {
      const fileName = item._sourceFileName || 'Unknown file';
      if (!sourceFiles.has(fileName)) {
        sourceFiles.set(fileName, 0);
      }
      sourceFiles.set(fileName, sourceFiles.get(fileName) + 1);
    }

    if (sourceFiles.size <= 1) return null;

    return (
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        boxShadow: theme.components.card.shadow,
        marginBottom: theme.spacing[4],
        overflow: 'hidden',
      }}>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
          }}>
            Source Files
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
            borderRadius: theme.borderRadius.full,
            background: theme.colors.neutral[100],
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.secondary,
          }}>
            {sourceFiles.size} {sourceFiles.size === 1 ? 'file' : 'files'}
          </span>
        </div>
        <div style={{
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing[2],
        }}>
          {[...sourceFiles.entries()].map(([fileName, count]) => (
            <div
              key={fileName}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[2],
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                background: theme.colors.neutral[50],
                border: `1px solid ${theme.colors.border.light}`,
                borderRadius: theme.borderRadius.lg,
              }}
            >
              <div style={{
                width: '1.5rem',
                height: '1.5rem',
                borderRadius: theme.borderRadius.md,
                background: theme.colors.info[50],
                color: theme.colors.info[700],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.fontFamily.mono,
                flexShrink: 0,
              }}>
                K
              </div>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '12rem',
              }}>
                {fileName}
              </span>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                flexShrink: 0,
              }}>
                {count} {count === 1 ? 'site' : 'sites'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => {
    if (isLoading || allGeospatialData.length > 0) return null;
    if (uploadsError || resultsError) return null;

    return (
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[8],
        boxShadow: theme.components.card.shadow,
        textAlign: 'center',
      }}>
        <div style={{
          width: '4rem',
          height: '4rem',
          borderRadius: theme.borderRadius.full,
          background: theme.colors.neutral[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: theme.spacing[4],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize['2xl'],
            color: theme.colors.text.tertiary,
            lineHeight: 1,
          }}>
            A
          </span>
        </div>
        <p style={{
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.text.secondary,
          margin: 0,
          marginBottom: theme.spacing[2],
        }}>
          No geospatial data available
        </p>
        <p style={{
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.text.tertiary,
          margin: 0,
          marginBottom: theme.spacing[6],
          maxWidth: '28rem',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          Upload and process KML or XML files to visualize cell sites and eNodeB locations on the atlas map.
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing[3],
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => handleNavigate('/upload')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[2],
              background: theme.components.button.primary.background,
              color: theme.components.button.primary.color,
              border: 'none',
              borderRadius: theme.components.button.primary.borderRadius,
              padding: `${theme.components.button.primary.paddingY} ${theme.components.button.primary.paddingX}`,
              fontSize: theme.components.button.primary.fontSize,
              fontWeight: theme.components.button.primary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.hoverBackground;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.primary.background;
            }}
          >
            ↑ Upload KML/XML File
          </button>
          <button
            onClick={() => handleNavigate('/dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              background: theme.components.button.secondary.background,
              color: theme.colors.text.secondary,
              border: theme.components.button.secondary.border,
              borderRadius: theme.components.button.secondary.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.components.button.secondary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: 'pointer',
              transition: theme.transitions.default,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
              e.currentTarget.style.color = theme.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.components.button.secondary.background;
              e.currentTarget.style.color = theme.colors.text.secondary;
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Supported file types hint */}
        <div style={{
          marginTop: theme.spacing[6],
          paddingTop: theme.spacing[4],
          borderTop: `1px solid ${theme.colors.border.light}`,
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.disabled,
            margin: 0,
            marginBottom: theme.spacing[2],
          }}>
            Supported geospatial file types
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: theme.spacing[2],
          }}>
            {['KML', 'XML'].map((type) => (
              <span
                key={type}
                style={{
                  display: 'inline-block',
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  background: theme.colors.neutral[100],
                  color: theme.colors.text.tertiary,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.mono,
                }}
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (isLoadingUploads && serverResults.length === 0 && allGeospatialData.length === 0) {
    return (
      <Layout>
        {renderPageHeader()}
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[8],
          boxShadow: theme.components.card.shadow,
        }}>
          <LoadingSpinner
            size="lg"
            message="Loading geospatial data..."
          />
        </div>
        <style>{`
          @keyframes atlasPageSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Layout>
    );
  }

  return (
    <Layout>
      {renderPageHeader()}

      {/* Uploads Error */}
      {uploadsError && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={uploadsError}
            severity="error"
            title="Failed to Load Uploads"
            onRetry={handleRetry}
            onDismiss={handleDismissUploadsError}
          />
        </div>
      )}

      {/* Results Error */}
      {resultsError && (
        <div style={{ marginBottom: theme.spacing[4] }}>
          <ErrorMessage
            message={resultsError}
            severity="warning"
            title="Failed to Load Some Results"
            onRetry={handleRetryResults}
            onDismiss={handleDismissResultsError}
          />
        </div>
      )}

      {/* Loading results indicator */}
      {isLoadingResults && allGeospatialData.length === 0 && (
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          padding: theme.spacing[8],
          boxShadow: theme.components.card.shadow,
          marginBottom: theme.spacing[4],
        }}>
          <LoadingSpinner
            size="md"
            message="Loading extraction results..."
          />
        </div>
      )}

      {/* Source Files Info */}
      {renderSourceFilesInfo()}

      {/* Empty State */}
      {renderEmptyState()}

      {/* Atlas View */}
      {allGeospatialData.length > 0 && (
        <AtlasView
          geospatialData={allGeospatialData}
          isLoading={isLoadingResults}
          error={null}
          onRetry={handleRetryResults}
          onDismissError={handleDismissResultsError}
        />
      )}

      <style>{`
        @keyframes atlasPageSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </Layout>
  );
};

export default AtlasPage;