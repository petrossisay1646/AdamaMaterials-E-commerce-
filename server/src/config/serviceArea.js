/**
 * Adama City Service Area Configuration & Geographic Validator
 * 
 * Centralized marketplace service-area boundary for AdaMaterials.
 * Used consistently across:
 * - Seller registration & shop location validation
 * - Buyer delivery address & checkout validation
 * - Map boundary constraints and filtering
 */

// Configurable polygon coordinates [latitude, longitude] enclosing the Adama City service area
// Includes: Kebele 01-14, Central Piazza/Stadium, Bole Subcity, Wonji corridor, Industrial Parks & Expressway access
const ADAMA_SERVICE_AREA_POLYGON = [
  [8.5950, 39.2450], // North-West: Expressway entrance / Migira
  [8.5980, 39.2950], // North: Kebele 01 & 02 outer perimeter
  [8.5850, 39.3250], // North-East: Kebele 03 / Ring road
  [8.5450, 39.3400], // East: Adama Industrial Park / Wonji junction
  [8.4980, 39.3300], // South-East: Kebele 13 & 14 outskirts
  [8.4650, 39.2850], // South: Wonji corridor / Kebele 11
  [8.4650, 39.2350], // South-West: Kebele 12 outskirts
  [8.5050, 39.2050], // West: Melka Hida / Kebele 08
  [8.5600, 39.2100], // North-West: Bole Subcity / Kebele 09 & 10
  [8.5950, 39.2450], // Closing polygon vertex
];

// Default Map Center [latitude, longitude]
const ADAMA_CENTER = {
  lat: 8.5400,
  lng: 39.2700,
  zoom: 13,
};

// Bounding box for map view clamping [ [minLat, minLng], [maxLat, maxLng] ]
const ADAMA_BOUNDS = [
  [8.4500, 39.1800],
  [8.6100, 39.3600],
];

/**
 * Validates whether a given [latitude, longitude] coordinate falls inside the Adama service area polygon.
 * Implements standard Point-in-Polygon (PIP) ray casting algorithm.
 * 
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @returns {boolean} - true if location is inside the service area
 */
function isLocationInAdamaServiceArea(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return false;
  }

  let inside = false;
  const polygon = ADAMA_SERVICE_AREA_POLYGON;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > numLng) !== (yj > numLng)) &&
      (numLat < ((xj - xi) * (numLng - yi)) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculates straight-line distance in kilometers between two coordinates (Haversine formula).
 * Used for initial spatial ordering before route calculation.
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

module.exports = {
  ADAMA_SERVICE_AREA_POLYGON,
  ADAMA_CENTER,
  ADAMA_BOUNDS,
  isLocationInAdamaServiceArea,
  calculateDistanceKm,
};