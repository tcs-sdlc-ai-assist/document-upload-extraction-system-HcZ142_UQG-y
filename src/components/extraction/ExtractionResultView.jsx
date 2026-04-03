import { useState, useCallback, useMemo } from 'react';
import DataTable from '../common/DataTable';
import ErrorMessage from '../common/ErrorMessage';
import LoadingSpinner from '../common/LoadingSpinner';
import theme from '../../config/theme';

const TAB_KEYS = {
  TEXT: 'text',
  TABLES: 'tables',
  METADATA: 'metadata',
  GEOSPATIAL: 'geospatial',
  HTML: 'html',
};

const FILE_TYPE_CATEGORIES = {
  text: ['pdf', 'docx', 'txt'],
  tabular: ['csv', 'xls', 'xlsx'],
  geospatial: ['kml', 'xml'],
};

const getFileCategory = (filetype) => {
  if (!filetype) return 'text';
  const normalized = filetype.toLowerCase().trim();
  for (const [category, types] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if (types.includes(normalized)) return category;
  }
  return 'text';
};

const getAvailableTabs = (result) => {
  if (!result) return [];

  const tabs = [];
  const category = getFileCategory(result.filetype);

  if (result.extracted_text && result.extracted_text.length > 0) {
    tabs.push({
      key: TAB_KEYS.TEXT,
      label: 'Extracted Text',
      icon: 'T',
    });
  }

  if (result.extracted_tables && result.extracted_tables.length > 0) {
    tabs.push({
      key: TAB_KEYS.TABLES,
      label: category === 'tabular' ? 'Data Tables' : 'Tables',
      icon: '⊞',
    });
  }

  if (result.extracted_html && result.extracted_html.length > 0) {
    tabs.push({
      key: TAB_KEYS.HTML,
      label: 'HTML Preview',
      icon: 'H',
    });
  }

  if (result.geospatial_data && result.geospatial_data.length > 0) {
    tabs.push({
      key: TAB_KEYS.GEOSPATIAL,
      label: 'Geospatial Data',
      icon: 'G',
    });
  }

  if (result.metadata && Object.keys(result.metadata).length > 0) {
    tabs.push({
      key: TAB_KEYS.METADATA,
      label: 'Metadata',
      icon: 'M',
    });
  }

  return tabs;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const ExtractionResultView = ({
  result = null,
  isLoading = false,
  error = null,
  onRetry = null,
  onDismissError = null,
  style = {},
}) => {
  const [activeTab, setActiveTab] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);

  const availableTabs = useMemo(() => {
    return getAvailableTabs(result);
  }, [result]);

  const resolvedActiveTab = useMemo(() => {
    if (!availableTabs || availableTabs.length === 0) return null;

    if (activeTab && availableTabs.find((t) => t.key === activeTab)) {
      return activeTab;
    }

    const category = result ? getFileCategory(result.filetype) : 'text';

    if (category === 'tabular') {
      const tablesTab = availableTabs.find((t) => t.key === TAB_KEYS.TABLES);
      if (tablesTab) return tablesTab.key;
    }

    if (category === 'geospatial') {
      const geoTab = availableTabs.find((t) => t.key === TAB_KEYS.GEOSPATIAL);
      if (geoTab) return geoTab.key;
    }

    return availableTabs[0].key;
  }, [activeTab, availableTabs, result]);

  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
    setCopySuccess(null);
  }, []);

  const handleCopyToClipboard = useCallback(async (text, label) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label || 'Content');
      setTimeout(() => {
        setCopySuccess(null);
      }, 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopySuccess(label || 'Content');
        setTimeout(() => {
          setCopySuccess(null);
        }, 2000);
      } catch {
        setCopySuccess(null);
      }
    }
  }, []);

  const handleDownload = useCallback((content, filename, mimeType) => {
    if (!content) return;

    try {
      const blob = new Blob([content], { type: mimeType || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'extracted_data.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
  }, []);

  const handleDownloadText = useCallback(() => {
    if (!result || !result.extracted_text) return;
    const baseName = result.file_name
      ? result.file_name.replace(/\.[^/.]+$/, '')
      : 'extracted';
    handleDownload(result.extracted_text, `${baseName}_text.txt`, 'text/plain');
  }, [result, handleDownload]);

  const handleDownloadTables = useCallback(() => {
    if (!result || !result.extracted_tables || result.extracted_tables.length === 0) return;

    const table = result.extracted_tables[selectedTableIndex] || result.extracted_tables[0];
    if (!table || !table.headers || !table.rows) return;

    const csvLines = [table.headers.join(',')];
    for (const row of table.rows) {
      const values = table.headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvLines.push(values.join(','));
    }

    const csvContent = csvLines.join('\n');
    const baseName = result.file_name
      ? result.file_name.replace(/\.[^/.]+$/, '')
      : 'extracted';
    const sheetName = table.sheet_name ? `_${table.sheet_name}` : '';
    handleDownload(csvContent, `${baseName}${sheetName}_table.csv`, 'text/csv');
  }, [result, selectedTableIndex, handleDownload]);

  const handleDownloadJSON = useCallback(() => {
    if (!result) return;

    const exportData = {
      file_name: result.file_name,
      filetype: result.filetype,
      extracted_text: result.extracted_text || '',
      extracted_tables: result.extracted_tables || [],
      metadata: result.metadata || {},
      geospatial_data: result.geospatial_data || undefined,
      page_count: result.page_count || null,
      processed_at: result.processed_at,
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const baseName = result.file_name
      ? result.file_name.replace(/\.[^/.]+$/, '')
      : 'extracted';
    handleDownload(jsonContent, `${baseName}_data.json`, 'application/json');
  }, [result, handleDownload]);

  const handleDownloadGeospatial = useCallback(() => {
    if (!result || !result.geospatial_data) return;

    const jsonContent = JSON.stringify(result.geospatial_data, null, 2);
    const baseName = result.file_name
      ? result.file_name.replace(/\.[^/.]+$/, '')
      : 'extracted';
    handleDownload(jsonContent, `${baseName}_geospatial.json`, 'application/json');
  }, [result, handleDownload]);

  if (isLoading) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[8],
        boxShadow: theme.components.card.shadow,
        ...style,
      }}>
        <LoadingSpinner
          size="lg"
          message="Loading extraction results..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        ...style,
      }}>
        <ErrorMessage
          message={error}
          severity="error"
          title="Extraction Error"
          onRetry={onRetry}
          onDismiss={onDismissError}
        />
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{
        fontFamily: theme.typography.fontFamily.sans,
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        padding: theme.spacing[8],
        boxShadow: theme.components.card.shadow,
        textAlign: 'center',
        ...style,
      }}>
        <div style={{
          width: '3rem',
          height: '3rem',
          borderRadius: theme.borderRadius.full,
          background: theme.colors.neutral[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: theme.spacing[3],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.xl,
            color: theme.colors.text.tertiary,
            lineHeight: 1,
          }}>
            ∅
          </span>
        </div>
        <p style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.text.secondary,
          margin: 0,
          marginBottom: theme.spacing[1],
        }}>
          No extraction results available
        </p>
        <p style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.tertiary,
          margin: 0,
        }}>
          Upload and process a document to see results here
        </p>
      </div>
    );
  }

  const category = getFileCategory(result.filetype);

  const renderFileHeader = () => (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
      borderBottom: `1px solid ${theme.colors.border.light}`,
      flexWrap: 'wrap',
      gap: theme.spacing[3],
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[3],
        flex: 1,
        minWidth: 0,
      }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: theme.borderRadius.lg,
          background: theme.colors.primary[50],
          color: theme.colors.primary[700],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          fontFamily: theme.typography.fontFamily.mono,
          flexShrink: 0,
          textTransform: 'uppercase',
        }}>
          {result.filetype ? result.filetype.substring(0, 3) : '?'}
        </div>
        <div style={{
          flex: 1,
          minWidth: 0,
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {result.file_name || 'Unknown file'}
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
            marginTop: '2px',
            flexWrap: 'wrap',
          }}>
            {result.filetype && (
              <span style={{
                display: 'inline-block',
                padding: `0 ${theme.spacing[2]}`,
                background: theme.colors.neutral[100],
                color: theme.colors.text.tertiary,
                borderRadius: theme.borderRadius.md,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.mono,
                textTransform: 'uppercase',
                lineHeight: '1.5',
              }}>
                {result.filetype}
              </span>
            )}
            {result.size > 0 && (
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
              }}>
                {formatFileSize(result.size)}
              </span>
            )}
            {result.page_count && (
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
              }}>
                • {result.page_count} {result.page_count === 1 ? 'page' : 'pages'}
              </span>
            )}
            {result.processed_at && (
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
              }}>
                • Processed {formatTimestamp(result.processed_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Download JSON button */}
      <button
        onClick={handleDownloadJSON}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[1],
          background: theme.components.button.secondary.background,
          color: theme.colors.text.secondary,
          border: theme.components.button.secondary.border,
          borderRadius: theme.components.button.secondary.borderRadius,
          padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.components.button.secondary.fontWeight,
          fontFamily: theme.typography.fontFamily.sans,
          cursor: 'pointer',
          transition: theme.transitions.default,
          whiteSpace: 'nowrap',
          flexShrink: 0,
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
        ↓ Export JSON
      </button>
    </div>
  );

  const renderTabs = () => {
    if (availableTabs.length <= 1) return null;

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[1],
        padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
        borderBottom: `1px solid ${theme.colors.border.light}`,
        overflowX: 'auto',
        background: theme.colors.background.secondary,
      }}>
        {availableTabs.map((tab) => {
          const isActive = resolvedActiveTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: isActive ? theme.colors.background.primary : 'transparent',
                color: isActive ? theme.colors.primary[700] : theme.colors.text.secondary,
                border: isActive ? `1px solid ${theme.colors.border.light}` : '1px solid transparent',
                borderBottom: isActive ? `1px solid ${theme.colors.background.primary}` : '1px solid transparent',
                borderRadius: `${theme.borderRadius.md} ${theme.borderRadius.md} 0 0`,
                padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: isActive
                  ? theme.typography.fontWeight.semibold
                  : theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
                position: 'relative',
                marginBottom: isActive ? '-1px' : '0',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = theme.colors.text.primary;
                  e.currentTarget.style.background = theme.colors.neutral[100];
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = theme.colors.text.secondary;
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{
                width: '1.25rem',
                height: '1.25rem',
                borderRadius: theme.borderRadius.md,
                background: isActive ? theme.colors.primary[100] : theme.colors.neutral[100],
                color: isActive ? theme.colors.primary[700] : theme.colors.text.tertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                flexShrink: 0,
              }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderCopyButton = (text, label) => (
    <button
      onClick={() => handleCopyToClipboard(text, label)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing[1],
        background: copySuccess === label
          ? theme.colors.success[50]
          : theme.components.button.secondary.background,
        color: copySuccess === label
          ? theme.colors.success[700]
          : theme.colors.text.secondary,
        border: copySuccess === label
          ? `1px solid ${theme.colors.success[200]}`
          : theme.components.button.secondary.border,
        borderRadius: theme.components.button.secondary.borderRadius,
        padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.medium,
        fontFamily: theme.typography.fontFamily.sans,
        cursor: 'pointer',
        transition: theme.transitions.default,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (copySuccess !== label) {
          e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
          e.currentTarget.style.color = theme.colors.text.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (copySuccess !== label) {
          e.currentTarget.style.background = theme.components.button.secondary.background;
          e.currentTarget.style.color = theme.colors.text.secondary;
        }
      }}
    >
      {copySuccess === label ? '✓ Copied' : '⎘ Copy'}
    </button>
  );

  const renderTextContent = () => {
    const text = result.extracted_text || '';

    if (!text) {
      return (
        <div style={{
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No text content extracted
          </p>
        </div>
      );
    }

    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    const lineCount = text.split('\n').length;
    const charCount = text.length;

    return (
      <div style={{ padding: theme.spacing[4] }}>
        {/* Text stats and actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing[3],
          flexWrap: 'wrap',
          gap: theme.spacing[2],
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {wordCount.toLocaleString()} words
            </span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.disabled,
            }}>
              •
            </span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {lineCount.toLocaleString()} lines
            </span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.disabled,
            }}>
              •
            </span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {charCount.toLocaleString()} chars
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            {renderCopyButton(text, 'Text')}
            <button
              onClick={handleDownloadText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.secondary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
                flexShrink: 0,
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
              ↓ Download
            </button>
          </div>
        </div>

        {/* Text content */}
        <div style={{
          background: theme.colors.background.tertiary,
          border: `1px solid ${theme.colors.border.light}`,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
          maxHeight: '32rem',
          overflowY: 'auto',
          position: 'relative',
        }}>
          <pre style={{
            fontFamily: theme.typography.fontFamily.mono,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.primary,
            lineHeight: theme.typography.lineHeight.relaxed,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {text}
          </pre>
        </div>
      </div>
    );
  };

  const renderTablesContent = () => {
    const tables = result.extracted_tables || [];

    if (tables.length === 0) {
      return (
        <div style={{
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No table data extracted
          </p>
        </div>
      );
    }

    const currentTable = tables[selectedTableIndex] || tables[0];
    const headers = currentTable.headers || [];
    const rows = currentTable.rows || [];

    const columns = headers.map((header) => ({
      key: header,
      label: header,
      sortable: true,
      align: 'left',
    }));

    return (
      <div style={{ padding: theme.spacing[4] }}>
        {/* Table selector and actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing[3],
          flexWrap: 'wrap',
          gap: theme.spacing[2],
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            {tables.length > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[1],
              }}>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.tertiary,
                  whiteSpace: 'nowrap',
                }}>
                  Sheet:
                </span>
                <select
                  value={selectedTableIndex}
                  onChange={(e) => setSelectedTableIndex(parseInt(e.target.value, 10))}
                  style={{
                    background: theme.components.input.background,
                    color: theme.components.input.color,
                    border: theme.components.input.border,
                    borderRadius: theme.components.input.borderRadius,
                    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                    fontSize: theme.typography.fontSize.xs,
                    fontFamily: theme.typography.fontFamily.sans,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: theme.transitions.default,
                  }}
                  onFocus={(e) => {
                    e.target.style.border = theme.components.input.borderFocus;
                    e.target.style.boxShadow = theme.components.input.boxShadowFocus;
                  }}
                  onBlur={(e) => {
                    e.target.style.border = theme.components.input.border;
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  {tables.map((table, idx) => (
                    <option key={idx} value={idx}>
                      {table.sheet_name || `Table ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {rows.length.toLocaleString()} rows × {headers.length} columns
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            {renderCopyButton(
              rows.map((row) => headers.map((h) => row[h] || '').join('\t')).join('\n'),
              'Table'
            )}
            <button
              onClick={handleDownloadTables}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.secondary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
                flexShrink: 0,
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
              ↓ CSV
            </button>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          data={rows}
          columns={columns}
          pageSize={25}
          sortable={true}
          paginated={true}
          striped={true}
          compact={false}
          emptyMessage="No rows in this table"
          maxHeight="32rem"
          stickyHeader={true}
          showRowNumbers={true}
        />
      </div>
    );
  };

  const renderHTMLContent = () => {
    const html = result.extracted_html || '';

    if (!html) {
      return (
        <div style={{
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No HTML content available
          </p>
        </div>
      );
    }

    return (
      <div style={{ padding: theme.spacing[4] }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: theme.spacing[3],
          gap: theme.spacing[2],
        }}>
          {renderCopyButton(html, 'HTML')}
        </div>
        <div style={{
          background: theme.colors.background.primary,
          border: `1px solid ${theme.colors.border.light}`,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
          maxHeight: '32rem',
          overflowY: 'auto',
        }}>
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
              fontFamily: theme.typography.fontFamily.sans,
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.primary,
              lineHeight: theme.typography.lineHeight.relaxed,
            }}
          />
        </div>
      </div>
    );
  };

  const renderGeospatialContent = () => {
    const geoData = result.geospatial_data || [];

    if (geoData.length === 0) {
      return (
        <div style={{
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No geospatial data extracted
          </p>
        </div>
      );
    }

    const geometryTypes = [...new Set(geoData.map((d) => d.geometry_type).filter(Boolean))];
    const totalCoordinates = geoData.reduce((sum, d) => sum + (d.coordinates ? d.coordinates.length : 0), 0);

    const tableData = geoData.map((item, idx) => ({
      index: idx + 1,
      name: item.name || '—',
      description: item.description || '—',
      geometry_type: item.geometry_type || '—',
      coordinates_count: item.coordinates ? item.coordinates.length : 0,
      style_url: item.style_url || '—',
    }));

    const geoColumns = [
      { key: 'index', label: '#', sortable: false, align: 'center', width: '3rem' },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'description', label: 'Description', sortable: true, maxWidth: '16rem' },
      { key: 'geometry_type', label: 'Geometry', sortable: true },
      { key: 'coordinates_count', label: 'Points', sortable: true, align: 'right' },
    ];

    return (
      <div style={{ padding: theme.spacing[4] }}>
        {/* Summary */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing[3],
          flexWrap: 'wrap',
          gap: theme.spacing[2],
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {geoData.length} {geoData.length === 1 ? 'placemark' : 'placemarks'}
            </span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.disabled,
            }}>
              •
            </span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
            }}>
              {totalCoordinates.toLocaleString()} coordinate points
            </span>
            {geometryTypes.length > 0 && (
              <>
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.disabled,
                }}>
                  •
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  flexWrap: 'wrap',
                }}>
                  {geometryTypes.map((type) => (
                    <span
                      key={type}
                      style={{
                        display: 'inline-block',
                        padding: `0 ${theme.spacing[2]}`,
                        background: theme.colors.info[50],
                        color: theme.colors.info[700],
                        borderRadius: theme.borderRadius.md,
                        fontSize: theme.typography.fontSize.xs,
                        fontWeight: theme.typography.fontWeight.medium,
                        lineHeight: '1.5',
                      }}
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            {renderCopyButton(JSON.stringify(geoData, null, 2), 'Geospatial')}
            <button
              onClick={handleDownloadGeospatial}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: theme.spacing[1],
                background: theme.components.button.secondary.background,
                color: theme.colors.text.secondary,
                border: theme.components.button.secondary.border,
                borderRadius: theme.components.button.secondary.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                transition: theme.transitions.default,
                whiteSpace: 'nowrap',
                flexShrink: 0,
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
              ↓ JSON
            </button>
          </div>
        </div>

        {/* Geospatial Data Table */}
        <DataTable
          data={tableData}
          columns={geoColumns}
          pageSize={25}
          sortable={true}
          paginated={true}
          striped={true}
          compact={false}
          emptyMessage="No placemarks found"
          maxHeight="32rem"
          stickyHeader={true}
        />
      </div>
    );
  };

  const renderMetadataContent = () => {
    const metadata = result.metadata || {};
    const entries = Object.entries(metadata);

    if (entries.length === 0) {
      return (
        <div style={{
          padding: theme.spacing[8],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            No metadata available
          </p>
        </div>
      );
    }

    const formatMetadataValue = (value) => {
      if (value === null || value === undefined) return '—';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (Array.isArray(value)) {
        if (value.length === 0) return '—';
        return value.join(', ');
      }
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    const metadataText = entries
      .map(([key, value]) => `${key}: ${formatMetadataValue(value)}`)
      .join('\n');

    return (
      <div style={{ padding: theme.spacing[4] }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: theme.spacing[3],
          gap: theme.spacing[2],
        }}>
          {renderCopyButton(metadataText, 'Metadata')}
        </div>

        <div style={{
          background: theme.colors.background.tertiary,
          border: `1px solid ${theme.colors.border.light}`,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        }}>
          {entries.map(([key, value], idx) => {
            const isEven = idx % 2 === 0;
            const displayValue = formatMetadataValue(value);
            const isLongValue = typeof value === 'object' && value !== null && !Array.isArray(value);

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: isLongValue ? 'flex-start' : 'center',
                  padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
                  background: isEven
                    ? theme.colors.background.primary
                    : theme.colors.background.tertiary,
                  borderBottom: idx < entries.length - 1
                    ? `1px solid ${theme.colors.border.light}`
                    : 'none',
                  gap: theme.spacing[4],
                }}
              >
                <span style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.secondary,
                  minWidth: '10rem',
                  flexShrink: 0,
                  textTransform: 'capitalize',
                }}>
                  {key.replace(/_/g, ' ')}
                </span>
                {isLongValue ? (
                  <pre style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text.primary,
                    fontFamily: theme.typography.fontFamily.mono,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {displayValue}
                  </pre>
                ) : (
                  <span style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text.primary,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={displayValue}
                  >
                    {displayValue}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActiveTabContent = () => {
    switch (resolvedActiveTab) {
      case TAB_KEYS.TEXT:
        return renderTextContent();
      case TAB_KEYS.TABLES:
        return renderTablesContent();
      case TAB_KEYS.HTML:
        return renderHTMLContent();
      case TAB_KEYS.GEOSPATIAL:
        return renderGeospatialContent();
      case TAB_KEYS.METADATA:
        return renderMetadataContent();
      default:
        return renderTextContent();
    }
  };

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
      background: theme.components.card.background,
      border: theme.components.card.border,
      borderRadius: theme.components.card.borderRadius,
      boxShadow: theme.components.card.shadow,
      overflow: 'hidden',
      ...style,
    }}>
      {renderFileHeader()}
      {renderTabs()}
      {renderActiveTabContent()}
    </div>
  );
};

export default ExtractionResultView;