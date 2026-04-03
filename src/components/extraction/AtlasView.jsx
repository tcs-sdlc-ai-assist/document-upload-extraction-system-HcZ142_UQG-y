import { useState, useCallback, useMemo, useEffect } from 'react';
import { useUpload } from '../../context/UploadContext';
import DataTable from '../common/DataTable';
import ErrorMessage from '../common/ErrorMessage';
import LoadingSpinner from '../common/LoadingSpinner';
import theme from '../../config/theme';

const GEOMETRY_COLORS = {
  Point: theme.colors.primary[500],
  LineString: theme.colors.info[500],
  Polygon: theme.colors.success[500],
  MultiGeometry: theme.colors.warning[500],
  default: theme.colors.neutral[400],
};

const GEOMETRY_ICONS = {
  Point: '●',
  LineString: '━',
  Polygon: '⬡',
  MultiGeometry: '◈',
  default: '○',
};

const MAP_BOUNDS = {
  minLat: -90,
  maxLat: 90,
  minLng: -180,
  maxLng: 180,
};

const formatCoordinate = (value, type) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const direction = type === 'lat'
    ? (value >= 0 ? 'N' : 'S')
    : (value >= 0 ? 'E' : 'W');
  return `${Math.abs(value).toFixed(6)}° ${direction}`;
};

const formatAltitude = (alt) => {
  if (alt === null || alt === undefined || isNaN(alt)) return '—';
  return `${alt.toFixed(1)} m`;
};

const calculateBounds = (placemarks) => {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  let hasCoords = false;

  for (const pm of placemarks) {
    if (!pm.coordinates || pm.coordinates.length === 0) continue;
    for (const coord of pm.coordinates) {
      if (coord.latitude !== undefined && coord.longitude !== undefined) {
        hasCoords = true;
        if (coord.latitude < minLat) minLat = coord.latitude;
        if (coord.latitude > maxLat) maxLat = coord.latitude;
        if (coord.longitude < minLng) minLng = coord.longitude;
        if (coord.longitude > maxLng) maxLng = coord.longitude;
      }
    }
  }

  if (!hasCoords) {
    return { minLat: -10, maxLat: 10, minLng: -10, maxLng: 10, hasCoords: false };
  }

  const latPadding = Math.max((maxLat - minLat) * 0.1, 0.01);
  const lngPadding = Math.max((maxLng - minLng) * 0.1, 0.01);

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
    hasCoords: true,
  };
};

const projectToCanvas = (lat, lng, bounds, width, height) => {
  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;

  const x = ((lng - bounds.minLng) / lngRange) * width;
  const y = ((bounds.maxLat - lat) / latRange) * height;

  return { x, y };
};

const AtlasView = ({
  geospatialData = null,
  extractionResults = null,
  isLoading = false,
  error = null,
  onRetry = null,
  onDismissError = null,
  style = {},
}) => {
  const { results, queue, uploads } = useUpload();

  const [selectedSiteIndex, setSelectedSiteIndex] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [filterGeometryType, setFilterGeometryType] = useState('all');
  const [viewMode, setViewMode] = useState('map');
  const [hoveredSiteIndex, setHoveredSiteIndex] = useState(null);

  const allGeospatialData = useMemo(() => {
    if (geospatialData && Array.isArray(geospatialData) && geospatialData.length > 0) {
      return geospatialData;
    }

    if (extractionResults && extractionResults.geospatial_data && Array.isArray(extractionResults.geospatial_data)) {
      return extractionResults.geospatial_data;
    }

    const collected = [];
    if (results && queue) {
      for (const fileId of queue) {
        const result = results[fileId];
        if (result && result.geospatial_data && Array.isArray(result.geospatial_data)) {
          for (const item of result.geospatial_data) {
            collected.push({
              ...item,
              _sourceFileId: fileId,
              _sourceFileName: uploads[fileId] ? uploads[fileId].file_name : null,
            });
          }
        }
      }
    }

    return collected;
  }, [geospatialData, extractionResults, results, queue, uploads]);

  const geometryTypes = useMemo(() => {
    const types = new Set();
    for (const pm of allGeospatialData) {
      if (pm.geometry_type) {
        types.add(pm.geometry_type);
      }
    }
    return [...types].sort();
  }, [allGeospatialData]);

  const filteredData = useMemo(() => {
    let data = allGeospatialData;

    if (filterGeometryType !== 'all') {
      data = data.filter((pm) => pm.geometry_type === filterGeometryType);
    }

    if (filterText.trim()) {
      const search = filterText.trim().toLowerCase();
      data = data.filter((pm) => {
        const name = (pm.name || '').toLowerCase();
        const description = (pm.description || '').toLowerCase();
        return name.includes(search) || description.includes(search);
      });
    }

    return data;
  }, [allGeospatialData, filterGeometryType, filterText]);

  const bounds = useMemo(() => {
    return calculateBounds(filteredData);
  }, [filteredData]);

  const stats = useMemo(() => {
    const totalPlacemarks = allGeospatialData.length;
    const totalCoordinates = allGeospatialData.reduce(
      (sum, pm) => sum + (pm.coordinates ? pm.coordinates.length : 0),
      0
    );
    const typeCounts = {};
    for (const pm of allGeospatialData) {
      const type = pm.geometry_type || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    return { totalPlacemarks, totalCoordinates, typeCounts };
  }, [allGeospatialData]);

  useEffect(() => {
    setSelectedSiteIndex(null);
  }, [filterText, filterGeometryType]);

  const handleSiteSelect = useCallback((index) => {
    setSelectedSiteIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleFilterTextChange = useCallback((e) => {
    setFilterText(e.target.value);
  }, []);

  const handleGeometryFilterChange = useCallback((e) => {
    setFilterGeometryType(e.target.value);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterText('');
    setFilterGeometryType('all');
    setSelectedSiteIndex(null);
  }, []);

  const handleCopyCoordinates = useCallback(async (site) => {
    if (!site || !site.coordinates || site.coordinates.length === 0) return;
    const coordText = site.coordinates
      .map((c) => `${c.latitude},${c.longitude},${c.altitude || 0}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(coordText);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = coordText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // silent fail
      }
    }
  }, []);

  const handleExportGeoJSON = useCallback(() => {
    if (filteredData.length === 0) return;

    const features = filteredData.map((pm) => {
      let geometry = null;

      if (pm.geometry_type === 'Point' && pm.coordinates && pm.coordinates.length > 0) {
        const c = pm.coordinates[0];
        geometry = {
          type: 'Point',
          coordinates: [c.longitude, c.latitude, c.altitude || 0],
        };
      } else if (pm.geometry_type === 'LineString' && pm.coordinates && pm.coordinates.length > 0) {
        geometry = {
          type: 'LineString',
          coordinates: pm.coordinates.map((c) => [c.longitude, c.latitude, c.altitude || 0]),
        };
      } else if (pm.geometry_type === 'Polygon' && pm.coordinates && pm.coordinates.length > 0) {
        geometry = {
          type: 'Polygon',
          coordinates: [pm.coordinates.map((c) => [c.longitude, c.latitude, c.altitude || 0])],
        };
      } else if (pm.coordinates && pm.coordinates.length > 0) {
        if (pm.coordinates.length === 1) {
          const c = pm.coordinates[0];
          geometry = {
            type: 'Point',
            coordinates: [c.longitude, c.latitude, c.altitude || 0],
          };
        } else {
          geometry = {
            type: 'LineString',
            coordinates: pm.coordinates.map((c) => [c.longitude, c.latitude, c.altitude || 0]),
          };
        }
      }

      return {
        type: 'Feature',
        properties: {
          name: pm.name || null,
          description: pm.description || null,
          geometry_type: pm.geometry_type || null,
          style_url: pm.style_url || null,
        },
        geometry,
      };
    }).filter((f) => f.geometry !== null);

    const geoJSON = {
      type: 'FeatureCollection',
      features,
    };

    try {
      const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atlas_export.geojson';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
  }, [filteredData]);

  const renderMapView = () => {
    const mapWidth = 800;
    const mapHeight = 500;

    if (filteredData.length === 0) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '20rem',
          background: theme.colors.background.tertiary,
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.colors.border.light}`,
        }}>
          <div style={{ textAlign: 'center' }}>
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
                G
              </span>
            </div>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              margin: 0,
            }}>
              No geospatial data to display
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        position: 'relative',
        background: '#e8ecf1',
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border.light}`,
        overflow: 'hidden',
      }}>
        {/* Map Grid Background */}
        <svg
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          style={{
            width: '100%',
            height: 'auto',
            minHeight: '20rem',
            maxHeight: '36rem',
            display: 'block',
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {Array.from({ length: 11 }, (_, i) => {
            const x = (i / 10) * mapWidth;
            return (
              <line
                key={`vgrid-${i}`}
                x1={x}
                y1={0}
                x2={x}
                y2={mapHeight}
                stroke={theme.colors.neutral[300]}
                strokeWidth="0.5"
                strokeDasharray="4,4"
                opacity="0.5"
              />
            );
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const y = (i / 7) * mapHeight;
            return (
              <line
                key={`hgrid-${i}`}
                x1={0}
                y1={y}
                x2={mapWidth}
                y2={y}
                stroke={theme.colors.neutral[300]}
                strokeWidth="0.5"
                strokeDasharray="4,4"
                opacity="0.5"
              />
            );
          })}

          {/* Render LineStrings and Polygons first (below points) */}
          {filteredData.map((pm, idx) => {
            if (!pm.coordinates || pm.coordinates.length < 2) return null;
            if (pm.geometry_type !== 'LineString' && pm.geometry_type !== 'Polygon') return null;

            const color = GEOMETRY_COLORS[pm.geometry_type] || GEOMETRY_COLORS.default;
            const isSelected = selectedSiteIndex === idx;
            const isHovered = hoveredSiteIndex === idx;

            const points = pm.coordinates.map((c) => {
              const pos = projectToCanvas(c.latitude, c.longitude, bounds, mapWidth, mapHeight);
              return `${pos.x},${pos.y}`;
            }).join(' ');

            if (pm.geometry_type === 'Polygon') {
              return (
                <polygon
                  key={`poly-${idx}`}
                  points={points}
                  fill={color}
                  fillOpacity={isSelected ? 0.35 : isHovered ? 0.25 : 0.15}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  strokeOpacity={isSelected ? 1 : 0.7}
                  style={{ cursor: 'pointer', transition: 'all 150ms ease-in-out' }}
                  onClick={() => handleSiteSelect(idx)}
                  onMouseEnter={() => setHoveredSiteIndex(idx)}
                  onMouseLeave={() => setHoveredSiteIndex(null)}
                />
              );
            }

            return (
              <polyline
                key={`line-${idx}`}
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 2}
                strokeOpacity={isSelected ? 1 : 0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ cursor: 'pointer', transition: 'all 150ms ease-in-out' }}
                onClick={() => handleSiteSelect(idx)}
                onMouseEnter={() => setHoveredSiteIndex(idx)}
                onMouseLeave={() => setHoveredSiteIndex(null)}
              />
            );
          })}

          {/* Render Points and MultiGeometry */}
          {filteredData.map((pm, idx) => {
            if (!pm.coordinates || pm.coordinates.length === 0) return null;

            const color = GEOMETRY_COLORS[pm.geometry_type] || GEOMETRY_COLORS.default;
            const isSelected = selectedSiteIndex === idx;
            const isHovered = hoveredSiteIndex === idx;

            if (pm.geometry_type === 'Point' || pm.geometry_type === 'MultiGeometry' || pm.coordinates.length === 1) {
              return pm.coordinates.map((c, cIdx) => {
                const pos = projectToCanvas(c.latitude, c.longitude, bounds, mapWidth, mapHeight);
                const radius = isSelected ? 8 : isHovered ? 7 : 5;

                return (
                  <g key={`point-${idx}-${cIdx}`}>
                    {/* Outer ring for selected/hovered */}
                    {(isSelected || isHovered) && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radius + 4}
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        opacity={isSelected ? 0.6 : 0.3}
                      />
                    )}
                    {/* Shadow */}
                    <circle
                      cx={pos.x}
                      cy={pos.y + 1}
                      r={radius}
                      fill="rgba(0,0,0,0.15)"
                    />
                    {/* Main dot */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={radius}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: 'pointer', transition: 'all 150ms ease-in-out' }}
                      onClick={() => handleSiteSelect(idx)}
                      onMouseEnter={() => setHoveredSiteIndex(idx)}
                      onMouseLeave={() => setHoveredSiteIndex(null)}
                    />
                    {/* Label for selected */}
                    {isSelected && pm.name && (
                      <g>
                        <rect
                          x={pos.x + 12}
                          y={pos.y - 12}
                          width={Math.min(pm.name.length * 7 + 12, 180)}
                          height={22}
                          rx={4}
                          fill="rgba(23,23,23,0.85)"
                        />
                        <text
                          x={pos.x + 18}
                          y={pos.y + 2}
                          fill="#ffffff"
                          fontSize="11"
                          fontFamily={theme.typography.fontFamily.sans}
                          fontWeight="500"
                        >
                          {pm.name.length > 22 ? pm.name.substring(0, 22) + '…' : pm.name}
                        </text>
                      </g>
                    )}
                  </g>
                );
              });
            }

            return null;
          })}

          {/* Coordinate labels on edges */}
          <text x={4} y={14} fill={theme.colors.text.tertiary} fontSize="10" fontFamily={theme.typography.fontFamily.mono}>
            {formatCoordinate(bounds.maxLat, 'lat')}
          </text>
          <text x={4} y={mapHeight - 4} fill={theme.colors.text.tertiary} fontSize="10" fontFamily={theme.typography.fontFamily.mono}>
            {formatCoordinate(bounds.minLat, 'lat')}
          </text>
          <text x={mapWidth - 4} y={mapHeight - 4} fill={theme.colors.text.tertiary} fontSize="10" fontFamily={theme.typography.fontFamily.mono} textAnchor="end">
            {formatCoordinate(bounds.maxLng, 'lng')}
          </text>
          <text x={4} y={mapHeight - 16} fill={theme.colors.text.tertiary} fontSize="10" fontFamily={theme.typography.fontFamily.mono}>
            {formatCoordinate(bounds.minLng, 'lng')}
          </text>
        </svg>

        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: theme.spacing[3],
          right: theme.spacing[3],
          background: 'rgba(255,255,255,0.92)',
          borderRadius: theme.borderRadius.lg,
          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
          boxShadow: theme.shadows.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text.primary,
            marginBottom: '2px',
          }}>
            Legend
          </span>
          {geometryTypes.map((type) => (
            <div key={type} style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[2],
            }}>
              <span style={{
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: type === 'Point' ? theme.borderRadius.full : '2px',
                background: GEOMETRY_COLORS[type] || GEOMETRY_COLORS.default,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
              }}>
                {type} ({stats.typeCounts[type] || 0})
              </span>
            </div>
          ))}
        </div>

        {/* Site count badge */}
        <div style={{
          position: 'absolute',
          top: theme.spacing[3],
          left: theme.spacing[3],
          background: 'rgba(255,255,255,0.92)',
          borderRadius: theme.borderRadius.lg,
          padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
          boxShadow: theme.shadows.sm,
        }}>
          <span style={{
            fontSize: theme.typography.fontSize.xs,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text.secondary,
          }}>
            {filteredData.length} {filteredData.length === 1 ? 'site' : 'sites'}
          </span>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    const tableData = filteredData.map((pm, idx) => {
      const firstCoord = pm.coordinates && pm.coordinates.length > 0 ? pm.coordinates[0] : null;
      return {
        index: idx + 1,
        name: pm.name || '—',
        description: pm.description || '—',
        geometry_type: pm.geometry_type || '—',
        latitude: firstCoord ? firstCoord.latitude : null,
        longitude: firstCoord ? firstCoord.longitude : null,
        altitude: firstCoord ? firstCoord.altitude : null,
        coordinates_count: pm.coordinates ? pm.coordinates.length : 0,
        style_url: pm.style_url || '—',
        _originalIndex: idx,
      };
    });

    const columns = [
      { key: 'index', label: '#', sortable: false, align: 'center', width: '3rem' },
      { key: 'name', label: 'Site Name', sortable: true },
      {
        key: 'geometry_type',
        label: 'Type',
        sortable: true,
        render: (value) => {
          const color = GEOMETRY_COLORS[value] || GEOMETRY_COLORS.default;
          const icon = GEOMETRY_ICONS[value] || GEOMETRY_ICONS.default;
          return (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing[1],
            }}>
              <span style={{
                color,
                fontSize: theme.typography.fontSize.sm,
                lineHeight: 1,
              }}>
                {icon}
              </span>
              <span>{value}</span>
            </span>
          );
        },
      },
      {
        key: 'latitude',
        label: 'Latitude',
        sortable: true,
        align: 'right',
        render: (value) => value !== null ? formatCoordinate(value, 'lat') : '—',
      },
      {
        key: 'longitude',
        label: 'Longitude',
        sortable: true,
        align: 'right',
        render: (value) => value !== null ? formatCoordinate(value, 'lng') : '—',
      },
      {
        key: 'altitude',
        label: 'Altitude',
        sortable: true,
        align: 'right',
        render: (value) => formatAltitude(value),
      },
      {
        key: 'coordinates_count',
        label: 'Points',
        sortable: true,
        align: 'right',
      },
    ];

    return (
      <DataTable
        data={tableData}
        columns={columns}
        pageSize={25}
        sortable={true}
        paginated={true}
        striped={true}
        compact={false}
        emptyMessage="No sites match the current filters"
        emptyIcon="G"
        maxHeight="32rem"
        stickyHeader={true}
        showRowNumbers={false}
        onRowClick={(row) => handleSiteSelect(row._originalIndex)}
        rowKeyField="index"
      />
    );
  };

  const renderSiteDetail = () => {
    if (selectedSiteIndex === null || !filteredData[selectedSiteIndex]) {
      return (
        <div style={{
          background: theme.colors.background.tertiary,
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.colors.border.light}`,
          padding: theme.spacing[6],
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.tertiary,
            margin: 0,
          }}>
            Select a site to view details
          </p>
        </div>
      );
    }

    const site = filteredData[selectedSiteIndex];
    const color = GEOMETRY_COLORS[site.geometry_type] || GEOMETRY_COLORS.default;
    const icon = GEOMETRY_ICONS[site.geometry_type] || GEOMETRY_ICONS.default;

    const detailFields = [
      { label: 'Name', value: site.name || '—' },
      { label: 'Description', value: site.description || '—' },
      { label: 'Geometry Type', value: site.geometry_type || '—' },
      { label: 'Coordinate Points', value: site.coordinates ? String(site.coordinates.length) : '0' },
      { label: 'Style URL', value: site.style_url || '—' },
    ];

    if (site._sourceFileName) {
      detailFields.push({ label: 'Source File', value: site._sourceFileName });
    }

    return (
      <div style={{
        background: theme.colors.background.primary,
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border.light}`,
        overflow: 'hidden',
      }}>
        {/* Detail Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          background: theme.colors.background.secondary,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <span style={{
              width: '2rem',
              height: '2rem',
              borderRadius: theme.borderRadius.lg,
              background: `${color}15`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.bold,
              flexShrink: 0,
            }}>
              {icon}
            </span>
            <div>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '16rem',
              }}>
                {site.name || 'Unnamed Site'}
              </p>
              <p style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.tertiary,
                margin: 0,
              }}>
                Site #{selectedSiteIndex + 1}
              </p>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[1],
          }}>
            <button
              onClick={() => handleCopyCoordinates(site)}
              style={{
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.components.button.secondary.background;
              }}
            >
              ⎘ Copy Coords
            </button>
            <button
              onClick={() => setSelectedSiteIndex(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.text.disabled,
                fontSize: theme.typography.fontSize.base,
                cursor: 'pointer',
                padding: theme.spacing[1],
                borderRadius: theme.borderRadius.md,
                transition: theme.transitions.default,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '1.75rem',
                height: '1.75rem',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.colors.neutral[100];
                e.currentTarget.style.color = theme.colors.text.secondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.text.disabled;
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Detail Fields */}
        <div style={{ padding: 0 }}>
          {detailFields.map((field, idx) => (
            <div
              key={field.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                background: idx % 2 === 0
                  ? theme.colors.background.primary
                  : theme.colors.background.tertiary,
                borderBottom: idx < detailFields.length - 1
                  ? `1px solid ${theme.colors.border.light}`
                  : 'none',
                gap: theme.spacing[3],
              }}
            >
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.tertiary,
                minWidth: '7rem',
                flexShrink: 0,
              }}>
                {field.label}
              </span>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.primary,
                wordBreak: 'break-word',
                flex: 1,
                minWidth: 0,
              }}>
                {field.value}
              </span>
            </div>
          ))}
        </div>

        {/* Coordinates Table */}
        {site.coordinates && site.coordinates.length > 0 && (
          <div style={{
            borderTop: `1px solid ${theme.colors.border.light}`,
          }}>
            <div style={{
              padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
              background: theme.colors.background.secondary,
              borderBottom: `1px solid ${theme.colors.border.light}`,
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.secondary,
              }}>
                Coordinates ({site.coordinates.length})
              </span>
            </div>
            <div style={{
              maxHeight: '12rem',
              overflowY: 'auto',
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                borderSpacing: 0,
              }}>
                <thead>
                  <tr style={{
                    background: theme.colors.background.tertiary,
                  }}>
                    <th style={{
                      padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text.tertiary,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: theme.typography.letterSpacing.wide,
                    }}>#</th>
                    <th style={{
                      padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text.tertiary,
                      textAlign: 'right',
                      textTransform: 'uppercase',
                      letterSpacing: theme.typography.letterSpacing.wide,
                    }}>Latitude</th>
                    <th style={{
                      padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text.tertiary,
                      textAlign: 'right',
                      textTransform: 'uppercase',
                      letterSpacing: theme.typography.letterSpacing.wide,
                    }}>Longitude</th>
                    <th style={{
                      padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                      fontSize: theme.typography.fontSize.xs,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text.tertiary,
                      textAlign: 'right',
                      textTransform: 'uppercase',
                      letterSpacing: theme.typography.letterSpacing.wide,
                    }}>Altitude</th>
                  </tr>
                </thead>
                <tbody>
                  {site.coordinates.map((coord, cIdx) => (
                    <tr
                      key={cIdx}
                      style={{
                        borderBottom: cIdx < site.coordinates.length - 1
                          ? `1px solid ${theme.colors.border.light}`
                          : 'none',
                        background: cIdx % 2 === 0
                          ? theme.colors.background.primary
                          : theme.colors.neutral[50],
                      }}
                    >
                      <td style={{
                        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.text.disabled,
                        textAlign: 'center',
                        fontFamily: theme.typography.fontFamily.mono,
                      }}>
                        {cIdx + 1}
                      </td>
                      <td style={{
                        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.text.primary,
                        textAlign: 'right',
                        fontFamily: theme.typography.fontFamily.mono,
                      }}>
                        {formatCoordinate(coord.latitude, 'lat')}
                      </td>
                      <td style={{
                        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.text.primary,
                        textAlign: 'right',
                        fontFamily: theme.typography.fontFamily.mono,
                      }}>
                        {formatCoordinate(coord.longitude, 'lng')}
                      </td>
                      <td style={{
                        padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.text.primary,
                        textAlign: 'right',
                        fontFamily: theme.typography.fontFamily.mono,
                      }}>
                        {formatAltitude(coord.altitude)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

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
          message="Loading geospatial data..."
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
          title="Atlas View Error"
          onRetry={onRetry}
          onDismiss={onDismissError}
        />
      </div>
    );
  }

  if (allGeospatialData.length === 0) {
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
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: theme.borderRadius.full,
          background: theme.colors.neutral[100],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: theme.spacing[3],
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
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.text.secondary,
          margin: 0,
          marginBottom: theme.spacing[1],
        }}>
          No geospatial data available
        </p>
        <p style={{
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.tertiary,
          margin: 0,
        }}>
          Upload and process a KML or XML file to visualize cell sites and eNodeB locations
        </p>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: theme.typography.fontFamily.sans,
      ...style,
    }}>
      {/* Header */}
      <div style={{
        background: theme.components.card.background,
        border: theme.components.card.border,
        borderRadius: theme.components.card.borderRadius,
        boxShadow: theme.components.card.shadow,
        marginBottom: theme.spacing[4],
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[4]} ${theme.spacing[4]} ${theme.spacing[3]}`,
          borderBottom: `1px solid ${theme.colors.border.light}`,
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}>
          <div>
            <h3 style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text.primary,
              margin: 0,
              marginBottom: theme.spacing[1],
              lineHeight: theme.typography.lineHeight.tight,
            }}>
              Atlas View
            </h3>
            <p style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary,
              margin: 0,
              lineHeight: theme.typography.lineHeight.normal,
            }}>
              Cell sites and eNodeB visualization from extracted geospatial data
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
            flexWrap: 'wrap',
          }}>
            {/* Stats badges */}
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
              {stats.totalPlacemarks} {stats.totalPlacemarks === 1 ? 'site' : 'sites'}
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
              {stats.totalCoordinates.toLocaleString()} coords
            </span>

            {/* Export button */}
            <button
              onClick={handleExportGeoJSON}
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
              ↓ GeoJSON
            </button>
          </div>
        </div>

        {/* Filters and View Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing[3]} ${theme.spacing[4]}`,
          flexWrap: 'wrap',
          gap: theme.spacing[3],
        }}>
          {/* Filters */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            flexWrap: 'wrap',
            flex: 1,
            minWidth: 0,
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '12rem', maxWidth: '20rem' }}>
              <input
                type="text"
                value={filterText}
                onChange={handleFilterTextChange}
                placeholder="Search sites..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: theme.components.input.background,
                  color: theme.components.input.color,
                  border: theme.components.input.border,
                  borderRadius: theme.components.input.borderRadius,
                  padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                  paddingLeft: theme.spacing[8],
                  fontSize: theme.typography.fontSize.sm,
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
              />
              <span style={{
                position: 'absolute',
                left: theme.spacing[3],
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.colors.text.disabled,
                fontSize: theme.typography.fontSize.sm,
                pointerEvents: 'none',
              }}>
                ⌕
              </span>
            </div>

            {/* Geometry Type Filter */}
            <select
              value={filterGeometryType}
              onChange={handleGeometryFilterChange}
              style={{
                background: theme.components.input.background,
                color: theme.components.input.color,
                border: theme.components.input.border,
                borderRadius: theme.components.input.borderRadius,
                padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.sm,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: 'pointer',
                outline: 'none',
                transition: theme.transitions.default,
                minWidth: '8rem',
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
              <option value="all">All Types</option>
              {geometryTypes.map((type) => (
                <option key={type} value={type}>
                  {type} ({stats.typeCounts[type] || 0})
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {(filterText || filterGeometryType !== 'all') && (
              <button
                onClick={handleClearFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: 'pointer',
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.md,
                  transition: theme.transitions.default,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.colors.error[600];
                  e.currentTarget.style.background = theme.colors.error[50];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.colors.text.tertiary;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[1],
            background: theme.colors.background.tertiary,
            borderRadius: theme.borderRadius.md,
            padding: '2px',
          }}>
            {[
              { key: 'map', label: 'Map', icon: '◎' },
              { key: 'table', label: 'Table', icon: '⊞' },
            ].map((mode) => {
              const isActive = viewMode === mode.key;
              return (
                <button
                  key={mode.key}
                  onClick={() => handleViewModeChange(mode.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: theme.spacing[1],
                    background: isActive ? theme.colors.background.primary : 'transparent',
                    color: isActive ? theme.colors.primary[700] : theme.colors.text.tertiary,
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: isActive
                      ? theme.typography.fontWeight.semibold
                      : theme.typography.fontWeight.medium,
                    fontFamily: theme.typography.fontFamily.sans,
                    cursor: 'pointer',
                    transition: theme.transitions.default,
                    whiteSpace: 'nowrap',
                    boxShadow: isActive ? theme.shadows.sm : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = theme.colors.text.secondary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = theme.colors.text.tertiary;
                    }
                  }}
                >
                  <span style={{ lineHeight: 1 }}>{mode.icon}</span>
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedSiteIndex !== null ? '1fr 22rem' : '1fr',
        gap: theme.spacing[4],
        alignItems: 'start',
      }}>
        {/* Map or Table View */}
        <div style={{
          background: theme.components.card.background,
          border: theme.components.card.border,
          borderRadius: theme.components.card.borderRadius,
          boxShadow: theme.components.card.shadow,
          overflow: 'hidden',
          padding: viewMode === 'map' ? theme.spacing[4] : 0,
        }}>
          {viewMode === 'map' ? renderMapView() : renderTableView()}
        </div>

        {/* Site Detail Panel */}
        {selectedSiteIndex !== null && (
          <div>
            {renderSiteDetail()}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AtlasView;