import { useState, useCallback, useMemo } from 'react';
import theme from '../../config/theme';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const formatCellValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const DataTable = ({
  data = [],
  columns = [],
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  sortable = true,
  paginated = true,
  striped = true,
  compact = false,
  emptyMessage = 'No data available',
  emptyIcon = '∅',
  title = null,
  subtitle = null,
  onRowClick = null,
  rowKeyField = null,
  maxHeight = null,
  stickyHeader = true,
  showRowNumbers = false,
  style = {},
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const resolvedColumns = useMemo(() => {
    if (columns && columns.length > 0) {
      return columns.map((col) => {
        if (typeof col === 'string') {
          return {
            key: col,
            label: col,
            sortable: sortable,
            align: 'left',
            width: null,
            render: null,
          };
        }
        return {
          key: col.key || col.field || col.accessor || '',
          label: col.label || col.header || col.title || col.key || '',
          sortable: col.sortable !== undefined ? col.sortable : sortable,
          align: col.align || 'left',
          width: col.width || null,
          render: col.render || null,
          minWidth: col.minWidth || null,
          maxWidth: col.maxWidth || null,
        };
      });
    }

    if (data && data.length > 0) {
      const firstRow = data[0];
      const keys = Object.keys(firstRow);
      return keys.map((key) => ({
        key,
        label: key,
        sortable: sortable,
        align: 'left',
        width: null,
        render: null,
      }));
    }

    return [];
  }, [columns, data, sortable]);

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    if (!sortColumn) {
      return [...data];
    }

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

      const aNum = Number(aVal);
      const bNum = Number(bVal);

      if (!isNaN(aNum) && !isNaN(bNum) && String(aVal).trim() !== '' && String(bVal).trim() !== '') {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [data, sortColumn, sortDirection]);

  const totalRows = sortedData.length;
  const totalPages = paginated ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;

  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedData = useMemo(() => {
    if (!paginated) {
      return sortedData;
    }

    const startIndex = (clampedPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, paginated, clampedPage, pageSize]);

  const handleSort = useCallback((columnKey) => {
    if (!sortable) return;

    const col = resolvedColumns.find((c) => c.key === columnKey);
    if (!col || !col.sortable) return;

    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }

    setCurrentPage(1);
  }, [sortable, sortColumn, sortDirection, resolvedColumns]);

  const handlePageChange = useCallback((page) => {
    const newPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(newPage);
  }, [totalPages]);

  const handlePageSizeChange = useCallback((newSize) => {
    const size = parseInt(newSize, 10);
    if (!isNaN(size) && size > 0) {
      setPageSize(size);
      setCurrentPage(1);
    }
  }, []);

  const handleRowClick = useCallback((row, rowIndex) => {
    if (onRowClick && typeof onRowClick === 'function') {
      onRowClick(row, rowIndex);
    }
  }, [onRowClick]);

  const getRowKey = useCallback((row, index) => {
    if (rowKeyField && row[rowKeyField] !== undefined && row[rowKeyField] !== null) {
      return String(row[rowKeyField]);
    }
    return String(index);
  }, [rowKeyField]);

  const getSortIndicator = useCallback((columnKey) => {
    if (sortColumn !== columnKey) {
      return (
        <span style={{
          color: theme.colors.text.disabled,
          fontSize: theme.typography.fontSize.xs,
          marginLeft: theme.spacing[1],
          opacity: 0.4,
        }}>
          ↕
        </span>
      );
    }

    return (
      <span style={{
        color: theme.colors.primary[600],
        fontSize: theme.typography.fontSize.xs,
        marginLeft: theme.spacing[1],
        fontWeight: theme.typography.fontWeight.bold,
      }}>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  }, [sortColumn, sortDirection]);

  const startRow = paginated ? (clampedPage - 1) * pageSize + 1 : 1;
  const endRow = paginated ? Math.min(clampedPage * pageSize, totalRows) : totalRows;

  const renderPaginationButtons = useCallback(() => {
    const buttons = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, clampedPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key="page-1"
          onClick={() => handlePageChange(1)}
          style={{
            ...paginationButtonStyle,
            background: clampedPage === 1 ? theme.colors.primary[50] : 'transparent',
            color: clampedPage === 1 ? theme.colors.primary[700] : theme.colors.text.secondary,
            fontWeight: clampedPage === 1 ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
          }}
        >
          1
        </button>
      );

      if (startPage > 2) {
        buttons.push(
          <span
            key="ellipsis-start"
            style={{
              padding: `0 ${theme.spacing[1]}`,
              color: theme.colors.text.disabled,
              fontSize: theme.typography.fontSize.xs,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            …
          </span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === clampedPage;
      buttons.push(
        <button
          key={`page-${i}`}
          onClick={() => handlePageChange(i)}
          style={{
            ...paginationButtonStyle,
            background: isActive ? theme.colors.primary[50] : 'transparent',
            color: isActive ? theme.colors.primary[700] : theme.colors.text.secondary,
            fontWeight: isActive ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = theme.colors.neutral[100];
              e.currentTarget.style.color = theme.colors.text.primary;
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.colors.text.secondary;
            }
          }}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span
            key="ellipsis-end"
            style={{
              padding: `0 ${theme.spacing[1]}`,
              color: theme.colors.text.disabled,
              fontSize: theme.typography.fontSize.xs,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            …
          </span>
        );
      }

      buttons.push(
        <button
          key={`page-${totalPages}`}
          onClick={() => handlePageChange(totalPages)}
          style={{
            ...paginationButtonStyle,
            background: clampedPage === totalPages ? theme.colors.primary[50] : 'transparent',
            color: clampedPage === totalPages ? theme.colors.primary[700] : theme.colors.text.secondary,
            fontWeight: clampedPage === totalPages ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
          }}
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  }, [clampedPage, totalPages, handlePageChange]);

  const paginationButtonStyle = {
    background: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontFamily.sans,
    cursor: 'pointer',
    transition: theme.transitions.default,
    minWidth: '2rem',
    height: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  };

  const cellPaddingY = compact ? theme.spacing[2] : theme.components.table.cellPaddingY;
  const cellPaddingX = compact ? theme.spacing[2] : theme.components.table.cellPaddingX;
  const cellFontSize = compact ? theme.typography.fontSize.xs : theme.components.table.cellFontSize;

  if (!data || data.length === 0) {
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
        {(title || subtitle) && (
          <div style={{
            padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
            borderBottom: `1px solid ${theme.colors.border.light}`,
          }}>
            {title && (
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                marginBottom: subtitle ? theme.spacing[1] : 0,
                lineHeight: theme.typography.lineHeight.tight,
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                margin: 0,
                lineHeight: theme.typography.lineHeight.normal,
              }}>
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div style={{
          padding: theme.spacing[8],
          textAlign: 'center',
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
              {emptyIcon}
            </span>
          </div>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

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
      {/* Title / Subtitle */}
      {(title || subtitle) && (
        <div style={{
          padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: theme.spacing[2],
        }}>
          <div>
            {title && (
              <h3 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                marginBottom: subtitle ? theme.spacing[1] : 0,
                lineHeight: theme.typography.lineHeight.tight,
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text.tertiary,
                margin: 0,
                lineHeight: theme.typography.lineHeight.normal,
              }}>
                {subtitle}
              </p>
            )}
          </div>

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
            {totalRows} {totalRows === 1 ? 'row' : 'rows'}
          </span>
        </div>
      )}

      {/* Table Container */}
      <div style={{
        overflowX: 'auto',
        maxHeight: maxHeight || undefined,
        overflowY: maxHeight ? 'auto' : undefined,
        position: 'relative',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderSpacing: 0,
          tableLayout: 'auto',
        }}>
          {/* Table Header */}
          <thead>
            <tr style={{
              background: theme.components.table.headerBackground,
              borderBottom: theme.components.table.rowBorder,
              ...(stickyHeader && maxHeight ? {
                position: 'sticky',
                top: 0,
                zIndex: 1,
              } : {}),
            }}>
              {showRowNumbers && (
                <th style={{
                  padding: `${cellPaddingY} ${cellPaddingX}`,
                  textAlign: 'center',
                  fontSize: theme.components.table.headerFontSize,
                  fontWeight: theme.components.table.headerFontWeight,
                  color: theme.components.table.headerColor,
                  textTransform: 'uppercase',
                  letterSpacing: theme.typography.letterSpacing.wide,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  width: '3rem',
                  background: theme.components.table.headerBackground,
                  borderBottom: theme.components.table.rowBorder,
                }}>
                  #
                </th>
              )}
              {resolvedColumns.map((col) => {
                const isSortable = col.sortable && sortable;
                const isCurrentSort = sortColumn === col.key;

                return (
                  <th
                    key={col.key}
                    onClick={isSortable ? () => handleSort(col.key) : undefined}
                    style={{
                      padding: `${cellPaddingY} ${cellPaddingX}`,
                      textAlign: col.align || 'left',
                      fontSize: theme.components.table.headerFontSize,
                      fontWeight: theme.components.table.headerFontWeight,
                      color: isCurrentSort ? theme.colors.primary[700] : theme.components.table.headerColor,
                      textTransform: 'uppercase',
                      letterSpacing: theme.typography.letterSpacing.wide,
                      whiteSpace: 'nowrap',
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      transition: theme.transitions.default,
                      width: col.width || undefined,
                      minWidth: col.minWidth || undefined,
                      maxWidth: col.maxWidth || undefined,
                      background: theme.components.table.headerBackground,
                      borderBottom: theme.components.table.rowBorder,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (isSortable && !isCurrentSort) {
                        e.currentTarget.style.color = theme.colors.text.primary;
                        e.currentTarget.style.background = theme.colors.neutral[100];
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isSortable && !isCurrentSort) {
                        e.currentTarget.style.color = theme.components.table.headerColor;
                        e.currentTarget.style.background = theme.components.table.headerBackground;
                      }
                    }}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}>
                      {col.label}
                      {isSortable && getSortIndicator(col.key)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {paginatedData.map((row, rowIndex) => {
              const absoluteIndex = paginated ? (clampedPage - 1) * pageSize + rowIndex : rowIndex;
              const rowKey = getRowKey(row, absoluteIndex);
              const isEvenRow = rowIndex % 2 === 0;
              const isClickable = !!onRowClick;

              return (
                <tr
                  key={rowKey}
                  onClick={isClickable ? () => handleRowClick(row, absoluteIndex) : undefined}
                  style={{
                    borderBottom: theme.components.table.rowBorder,
                    background: striped && !isEvenRow
                      ? theme.colors.neutral[50]
                      : theme.colors.background.primary,
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: theme.transitions.fast,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.components.table.rowHoverBackground;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = striped && !isEvenRow
                      ? theme.colors.neutral[50]
                      : theme.colors.background.primary;
                  }}
                >
                  {showRowNumbers && (
                    <td style={{
                      padding: `${cellPaddingY} ${cellPaddingX}`,
                      textAlign: 'center',
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.disabled,
                      fontFamily: theme.typography.fontFamily.mono,
                      whiteSpace: 'nowrap',
                    }}>
                      {absoluteIndex + 1}
                    </td>
                  )}
                  {resolvedColumns.map((col) => {
                    const cellValue = row[col.key];
                    const displayValue = col.render
                      ? col.render(cellValue, row, absoluteIndex)
                      : formatCellValue(cellValue);

                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: `${cellPaddingY} ${cellPaddingX}`,
                          textAlign: col.align || 'left',
                          fontSize: cellFontSize,
                          color: theme.colors.text.primary,
                          lineHeight: theme.typography.lineHeight.normal,
                          maxWidth: col.maxWidth || '20rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }}
                        title={typeof displayValue === 'string' ? displayValue : undefined}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {paginated && totalRows > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderTop: `1px solid ${theme.colors.border.light}`,
          flexWrap: 'wrap',
          gap: theme.spacing[3],
          background: theme.colors.background.primary,
        }}>
          {/* Left: Row info + page size selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.tertiary,
              whiteSpace: 'nowrap',
            }}>
              Showing {startRow}–{endRow} of {totalRows}
            </span>

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
                Rows per page:
              </span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(e.target.value)}
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
                  minWidth: '3.5rem',
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
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Pagination controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
            }}>
              {/* Previous button */}
              <button
                onClick={() => handlePageChange(clampedPage - 1)}
                disabled={clampedPage <= 1}
                style={{
                  ...paginationButtonStyle,
                  color: clampedPage <= 1 ? theme.colors.text.disabled : theme.colors.text.secondary,
                  cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: clampedPage <= 1 ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (clampedPage > 1) {
                    e.currentTarget.style.background = theme.colors.neutral[100];
                    e.currentTarget.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (clampedPage > 1) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                  }
                }}
                aria-label="Previous page"
              >
                ‹
              </button>

              {/* Page number buttons */}
              {renderPaginationButtons()}

              {/* Next button */}
              <button
                onClick={() => handlePageChange(clampedPage + 1)}
                disabled={clampedPage >= totalPages}
                style={{
                  ...paginationButtonStyle,
                  color: clampedPage >= totalPages ? theme.colors.text.disabled : theme.colors.text.secondary,
                  cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: clampedPage >= totalPages ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (clampedPage < totalPages) {
                    e.currentTarget.style.background = theme.colors.neutral[100];
                    e.currentTarget.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (clampedPage < totalPages) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                  }
                }}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;