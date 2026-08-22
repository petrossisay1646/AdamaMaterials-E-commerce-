const axios = require('axios');
const User = require('../models/User');
const Product = require('../models/Product');
const MapPlace = require('../models/MapPlace');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const {
  ADAMA_SERVICE_AREA_POLYGON,
  ADAMA_CENTER,
  ADAMA_BOUNDS,
  isLocationInAdamaServiceArea,
  calculateDistanceKm,
} = require('../config/serviceArea');

// 1. Get All Verified Map Places & Approved Sellers
exports.getMarketplaceMapData = asyncHandler(async (req, res, next) => {
  const { buyerLat, buyerLng, category, search } = req.query;

  const hasBuyerLocation =
    buyerLat !== undefined &&
    buyerLng !== undefined &&
    !isNaN(Number(buyerLat)) &&
    !isNaN(Number(buyerLng));

  const numBuyerLat = hasBuyerLocation ? Number(buyerLat) : null;
  const numBuyerLng = hasBuyerLocation ? Number(buyerLng) : null;

  // A. Approved Marketplace Sellers with configured shop coordinates
  const sellerFilter = {
    role: 'SELLER',
    'sellerProfile.approvalStatus': 'APPROVED',
    'sellerProfile.shopLocation.coordinates': { $exists: true, $ne: [] },
  };

  const approvedSellers = await User.find(sellerFilter)
    .select('name sellerProfile createdAt')
    .populate('sellerProfile.categoriesSold', 'name');

  // Fetch product inventory counts for each seller
  const sellerProductCounts = await Product.aggregate([
    { $match: { approvalStatus: 'APPROVED' } },
    { $group: { _id: '$seller', count: { $sum: 1 } } },
  ]);
  const productCountMap = {};
  sellerProductCounts.forEach((s) => {
    productCountMap[s._id.toString()] = s.count;
  });

  const sellerMarkers = approvedSellers
    .filter((s) => {
      const coords = s.sellerProfile?.shopLocation?.coordinates;
      return Array.isArray(coords) && coords.length === 2 && coords[0] && coords[1];
    })
    .map((s) => {
      const lng = s.sellerProfile.shopLocation.coordinates[0];
      const lat = s.sellerProfile.shopLocation.coordinates[1];

      let distanceKm = null;
      if (hasBuyerLocation) {
        distanceKm = calculateDistanceKm(numBuyerLat, numBuyerLng, lat, lng);
      }

      return {
        id: s._id,
        placeType: 'MARKETPLACE_SELLER',
        title: s.sellerProfile.shopName || s.name,
        ownerName: s.name,
        description: s.sellerProfile.shopDescription || 'Approved AdaMaterials Seller',
        address: s.sellerProfile.shopLocation.address || s.sellerProfile.shopAddress || 'Adama, Ethiopia',
        coordinates: [lat, lng], // Leaflet uses [lat, lng]
        categories: (s.sellerProfile.categoriesSold || []).map((c) => c.name || c),
        availableProductsCount: productCountMap[s._id.toString()] || 0,
        isVerified: true,
        source: 'ADAMATERIALS_MARKETPLACE',
        distanceKm,
      };
    });

  // B. Admin-Managed Verified Local Depots
  const mapPlaceFilter = { isActive: true };
  if (category) {
    mapPlaceFilter.category = new RegExp(category, 'i');
  }
  if (search) {
    mapPlaceFilter.$or = [
      { name: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { materials: new RegExp(search, 'i') },
    ];
  }

  const mapPlaces = await MapPlace.find(mapPlaceFilter);

  const placeMarkers = mapPlaces.map((p) => {
    const lng = p.location.coordinates[0];
    const lat = p.location.coordinates[1];

    let distanceKm = null;
    if (hasBuyerLocation) {
      distanceKm = calculateDistanceKm(numBuyerLat, numBuyerLng, lat, lng);
    }

    return {
      id: p._id,
      placeType: p.source === 'OSM_EXTERNAL' ? 'OSM_EXTERNAL' : 'ADMIN_MANAGED',
      title: p.name,
      category: p.category,
      materials: p.materials || [],
      description: p.description,
      address: p.address,
      phone: p.phone || '',
      coordinates: [lat, lng],
      isVerified: p.isVerified,
      source: p.source,
      distanceKm,
    };
  });

  // Combine and sort by distance if buyer coordinates provided
  let allPlaces = [...sellerMarkers, ...placeMarkers];

  if (hasBuyerLocation) {
    allPlaces.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  res.status(200).json({
    success: true,
    count: allPlaces.length,
    serviceArea: {
      center: ADAMA_CENTER,
      bounds: ADAMA_BOUNDS,
      polygon: ADAMA_SERVICE_AREA_POLYGON,
    },
    buyerLocation: hasBuyerLocation ? { lat: numBuyerLat, lng: numBuyerLng } : null,
    places: allPlaces,
  });
});

// 2. Road Routing & Distance Proxy (OSRM with fallback)
exports.getRoadRoute = asyncHandler(async (req, res, next) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;

  if (!fromLat || !fromLng || !toLat || !toLng) {
    return next(new AppError('fromLat, fromLng, toLat, and toLng coordinates are required.', 400));
  }

  const numFromLat = Number(fromLat);
  const numFromLng = Number(fromLng);
  const numToLat = Number(toLat);
  const numToLng = Number(toLng);

  const straightLineKm = calculateDistanceKm(numFromLat, numFromLng, numToLat, numToLng);

  try {
    // Call OSRM public driving API: lng,lat;lng,lat
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${numFromLng},${numFromLat};${numToLng},${numToLat}?overview=full&geometries=geojson`;
    const response = await axios.get(osrmUrl, { timeout: 4000 });

    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const durationMin = Math.round(route.duration / 60);

      // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng] format
      const latLngPoints = (route.geometry.coordinates || []).map((coord) => [coord[1], coord[0]]);

      return res.status(200).json({
        success: true,
        source: 'OSRM_ROAD_ROUTING',
        distanceKm,
        durationMin: durationMin > 0 ? durationMin : 1,
        routeGeometry: latLngPoints,
      });
    }
  } catch (err) {
    console.warn('[Map Routing] OSRM service unavailable, using robust geometric fallback:', err.message);
  }

  // Graceful fallback when external OSRM is unreachable
  // Urban driving in Adama: average road distance is ~1.25x straight-line, average city speed ~30 km/h
  const estimatedRoadKm = Math.round(straightLineKm * 1.25 * 10) / 10;
  const estimatedDurationMin = Math.max(1, Math.round((estimatedRoadKm / 30) * 60));

  res.status(200).json({
    success: true,
    source: 'GEOMETRIC_FALLBACK',
    distanceKm: estimatedRoadKm,
    durationMin: estimatedDurationMin,
    routeGeometry: [
      [numFromLat, numFromLng],
      [numToLat, numToLng],
    ],
  });
});