const { XMLParser } = require('fast-xml-parser');
const logger = require('../utils/logger');

const extract = async (buffer) => {
  logger.info('Starting KML extraction');

  if (!buffer || buffer.length === 0) {
    logger.warn('KML extraction failed: empty buffer provided');
    throw new KmlExtractionError('KML buffer is empty or not provided');
  }

  try {
    const startTime = Date.now();

    const kmlString = buffer.toString('utf-8');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      isArray: (name) => {
        const arrayTags = ['Placemark', 'Point', 'LineString', 'Polygon', 'LinearRing', 'Folder', 'Document'];
        return arrayTags.includes(name);
      },
    });

    let parsed;
    try {
      parsed = parser.parse(kmlString);
    } catch (parseErr) {
      throw new KmlExtractionError(
        'The KML file contains invalid XML and cannot be parsed'
      );
    }

    const kmlRoot = parsed.kml || parsed.KML;

    if (!kmlRoot) {
      throw new KmlExtractionError(
        'The file does not appear to be a valid KML document (missing <kml> root element)'
      );
    }

    const placemarks = [];
    const folders = [];

    collectPlacemarks(kmlRoot, placemarks, folders);

    const duration = Date.now() - startTime;

    const extractedText = placemarksToText(placemarks);

    const extractedTables = [];

    if (placemarks.length > 0) {
      const headers = ['name', 'description', 'geometry_type', 'coordinates'];
      const rows = placemarks.map((pm) => ({
        name: pm.name || '',
        description: pm.description || '',
        geometry_type: pm.geometry_type || '',
        coordinates: pm.coordinates_raw || '',
      }));

      extractedTables.push({
        headers,
        rows,
        row_count: rows.length,
        column_count: headers.length,
      });
    }

    const geospatialData = placemarks.map((pm) => ({
      name: pm.name || null,
      description: pm.description || null,
      geometry_type: pm.geometry_type || null,
      coordinates: pm.coordinates || [],
      style_url: pm.styleUrl || null,
    }));

    const documentName = extractDocumentName(kmlRoot);
    const documentDescription = extractDocumentDescription(kmlRoot);

    const metadata = {
      format: 'KML',
      document_name: documentName,
      document_description: documentDescription,
      placemark_count: placemarks.length,
      folder_count: folders.length,
      geometry_types: [...new Set(placemarks.map((pm) => pm.geometry_type).filter(Boolean))],
      text_length: extractedText.length,
    };

    logger.info('KML extraction completed successfully', {
      placemarkCount: placemarks.length,
      folderCount: folders.length,
      textLength: extractedText.length,
      duration: `${duration}ms`,
    });

    return {
      extracted_text: extractedText,
      extracted_tables: extractedTables,
      geospatial_data: geospatialData,
      metadata,
      page_count: null,
    };
  } catch (err) {
    if (err instanceof KmlExtractionError) {
      throw err;
    }

    logger.error('KML extraction failed', {
      error: err.message,
      stack: err.stack,
    });

    if (
      err.message &&
      (err.message.includes('Invalid XML') ||
        err.message.includes('invalid') ||
        err.message.includes('Unexpected') ||
        err.message.includes('malformed') ||
        err.message.includes('not well-formed') ||
        err.message.includes('Unclosed') ||
        err.message.includes('closing tag') ||
        err.message.includes('char') ||
        err.message.includes('parse'))
    ) {
      throw new KmlExtractionError(
        'The KML file appears to be malformed or contains invalid XML and cannot be processed'
      );
    }

    throw new KmlExtractionError(
      `Failed to extract data from KML: ${err.message}`
    );
  }
};

const collectPlacemarks = (node, placemarks, folders, depth = 0) => {
  if (!node || typeof node !== 'object' || depth > 50) {
    return;
  }

  if (node.Document) {
    const documents = Array.isArray(node.Document) ? node.Document : [node.Document];
    for (const doc of documents) {
      collectPlacemarks(doc, placemarks, folders, depth + 1);
    }
  }

  if (node.Folder) {
    const folderList = Array.isArray(node.Folder) ? node.Folder : [node.Folder];
    for (const folder of folderList) {
      const folderName = extractTextValue(folder.name);
      folders.push({ name: folderName });
      collectPlacemarks(folder, placemarks, folders, depth + 1);
    }
  }

  if (node.Placemark) {
    const placemarkList = Array.isArray(node.Placemark) ? node.Placemark : [node.Placemark];
    for (const pm of placemarkList) {
      const placemark = parsePlacemark(pm);
      if (placemark) {
        placemarks.push(placemark);
      }
    }
  }
};

const parsePlacemark = (pm) => {
  if (!pm || typeof pm !== 'object') {
    return null;
  }

  const name = extractTextValue(pm.name);
  const description = extractTextValue(pm.description);
  const styleUrl = extractTextValue(pm.styleUrl);

  let geometryType = null;
  let coordinates = [];
  let coordinatesRaw = '';

  if (pm.Point) {
    const point = Array.isArray(pm.Point) ? pm.Point[0] : pm.Point;
    geometryType = 'Point';
    const coordResult = parseCoordinates(extractTextValue(point.coordinates));
    coordinates = coordResult;
    coordinatesRaw = extractTextValue(point.coordinates);
  } else if (pm.LineString) {
    const lineString = Array.isArray(pm.LineString) ? pm.LineString[0] : pm.LineString;
    geometryType = 'LineString';
    const coordResult = parseCoordinates(extractTextValue(lineString.coordinates));
    coordinates = coordResult;
    coordinatesRaw = extractTextValue(lineString.coordinates);
  } else if (pm.Polygon) {
    const polygon = Array.isArray(pm.Polygon) ? pm.Polygon[0] : pm.Polygon;
    geometryType = 'Polygon';
    const coordResult = extractPolygonCoordinates(polygon);
    coordinates = coordResult.coordinates;
    coordinatesRaw = coordResult.raw;
  } else if (pm.MultiGeometry) {
    geometryType = 'MultiGeometry';
    const multiResult = extractMultiGeometryCoordinates(pm.MultiGeometry);
    coordinates = multiResult.coordinates;
    coordinatesRaw = multiResult.raw;
  }

  return {
    name,
    description,
    geometry_type: geometryType,
    coordinates,
    coordinates_raw: coordinatesRaw,
    styleUrl,
  };
};

const parseCoordinates = (coordString) => {
  if (!coordString || typeof coordString !== 'string') {
    return [];
  }

  const trimmed = coordString.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const coordPairs = trimmed.split(/\s+/);
  const coordinates = [];

  for (const pair of coordPairs) {
    const parts = pair.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const alt = parts.length >= 3 ? parseFloat(parts[2]) : 0;

      if (!isNaN(lng) && !isNaN(lat)) {
        const coord = {
          longitude: lng,
          latitude: lat,
          altitude: isNaN(alt) ? 0 : alt,
        };
        coordinates.push(coord);
      }
    }
  }

  return coordinates;
};

const extractPolygonCoordinates = (polygon) => {
  if (!polygon || typeof polygon !== 'object') {
    return { coordinates: [], raw: '' };
  }

  const allCoordinates = [];
  const rawParts = [];

  if (polygon.outerBoundaryIs) {
    const outer = polygon.outerBoundaryIs;
    if (outer.LinearRing) {
      const ring = Array.isArray(outer.LinearRing) ? outer.LinearRing[0] : outer.LinearRing;
      const coordStr = extractTextValue(ring.coordinates);
      rawParts.push(coordStr);
      const coords = parseCoordinates(coordStr);
      allCoordinates.push(...coords);
    }
  }

  if (polygon.innerBoundaryIs) {
    const innerList = Array.isArray(polygon.innerBoundaryIs)
      ? polygon.innerBoundaryIs
      : [polygon.innerBoundaryIs];
    for (const inner of innerList) {
      if (inner.LinearRing) {
        const ring = Array.isArray(inner.LinearRing) ? inner.LinearRing[0] : inner.LinearRing;
        const coordStr = extractTextValue(ring.coordinates);
        rawParts.push(coordStr);
        const coords = parseCoordinates(coordStr);
        allCoordinates.push(...coords);
      }
    }
  }

  return {
    coordinates: allCoordinates,
    raw: rawParts.join(' '),
  };
};

const extractMultiGeometryCoordinates = (multiGeometry) => {
  if (!multiGeometry || typeof multiGeometry !== 'object') {
    return { coordinates: [], raw: '' };
  }

  const allCoordinates = [];
  const rawParts = [];

  if (multiGeometry.Point) {
    const points = Array.isArray(multiGeometry.Point) ? multiGeometry.Point : [multiGeometry.Point];
    for (const point of points) {
      const coordStr = extractTextValue(point.coordinates);
      rawParts.push(coordStr);
      const coords = parseCoordinates(coordStr);
      allCoordinates.push(...coords);
    }
  }

  if (multiGeometry.LineString) {
    const lines = Array.isArray(multiGeometry.LineString) ? multiGeometry.LineString : [multiGeometry.LineString];
    for (const line of lines) {
      const coordStr = extractTextValue(line.coordinates);
      rawParts.push(coordStr);
      const coords = parseCoordinates(coordStr);
      allCoordinates.push(...coords);
    }
  }

  if (multiGeometry.Polygon) {
    const polygons = Array.isArray(multiGeometry.Polygon) ? multiGeometry.Polygon : [multiGeometry.Polygon];
    for (const polygon of polygons) {
      const result = extractPolygonCoordinates(polygon);
      allCoordinates.push(...result.coordinates);
      rawParts.push(result.raw);
    }
  }

  return {
    coordinates: allCoordinates,
    raw: rawParts.join(' '),
  };
};

const extractTextValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object' && value['#text'] !== undefined) {
    return String(value['#text']).trim();
  }

  return String(value).trim();
};

const extractDocumentName = (kmlRoot) => {
  if (!kmlRoot) {
    return null;
  }

  if (kmlRoot.Document) {
    const doc = Array.isArray(kmlRoot.Document) ? kmlRoot.Document[0] : kmlRoot.Document;
    if (doc && doc.name) {
      return extractTextValue(doc.name);
    }
  }

  if (kmlRoot.name) {
    return extractTextValue(kmlRoot.name);
  }

  return null;
};

const extractDocumentDescription = (kmlRoot) => {
  if (!kmlRoot) {
    return null;
  }

  if (kmlRoot.Document) {
    const doc = Array.isArray(kmlRoot.Document) ? kmlRoot.Document[0] : kmlRoot.Document;
    if (doc && doc.description) {
      return extractTextValue(doc.description);
    }
  }

  if (kmlRoot.description) {
    return extractTextValue(kmlRoot.description);
  }

  return null;
};

const placemarksToText = (placemarks) => {
  if (!placemarks || placemarks.length === 0) {
    return '';
  }

  const lines = [];

  for (const pm of placemarks) {
    const parts = [];

    if (pm.name) {
      parts.push(`Name: ${pm.name}`);
    }

    if (pm.description) {
      parts.push(`Description: ${pm.description}`);
    }

    if (pm.geometry_type) {
      parts.push(`Type: ${pm.geometry_type}`);
    }

    if (pm.coordinates && pm.coordinates.length > 0) {
      const coordStrings = pm.coordinates.map(
        (c) => `${c.latitude},${c.longitude},${c.altitude}`
      );
      parts.push(`Coordinates: ${coordStrings.join(' ')}`);
    }

    if (parts.length > 0) {
      lines.push(parts.join(' | '));
    }
  }

  return lines.join('\n');
};

class KmlExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KmlExtractionError';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  extract,
  KmlExtractionError,
};