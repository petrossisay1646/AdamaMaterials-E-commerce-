import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Store,
  Building2,
  Globe,
  MapPin,
  Navigation,
  Search,
  ArrowUpRight,
  Clock,
  Car,
  X,
  Phone,
  CheckCircle2,
  Compass,
  AlertCircle,
  ShieldAlert,
  Radio,
  RefreshCw,
  Info,
} from 'lucide-react';

interface PlaceItem {
  id: string;
  placeType: 'MARKETPLACE_SELLER' | 'ADMIN_MANAGED' | 'OSM_EXTERNAL';
  title: string;
  ownerName?: string;
  category?: string;
  materials?: string[];
  description?: string;
  address: string;
  phone?: string;
  coordinates: [number, number]; // [lat, lng]
  categories?: string[];
  availableProductsCount?: number;
  isVerified?: boolean;
  source?: string;
  distanceKm?: number | null;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  source: string;
  targetTitle: string;
}

interface DetectedLocation {
  lat: number;
  lng: number;
  accuracy: number;
  isInside: boolean;
  timestamp: number;
}

// Map default center (where the map starts before GPS is detected)
const ADAMA_CENTER_COORDS: [number, number] = [8.5400, 39.2700];

// Official Polygon boundary for Adama City Service Area
const ADAMA_SERVICE_AREA: [number, number][] = [
  [8.5950, 39.2450],
  [8.5980, 39.2950],
  [8.5850, 39.3250],
  [8.5450, 39.3400],
  [8.4980, 39.3300],
  [8.4650, 39.2850],
  [8.4650, 39.2350],
  [8.5050, 39.2050],
  [8.5600, 39.2100],
  [8.5950, 39.2450],
];

// Point-in-Polygon ray casting algorithm
const isInsideAdamaServiceArea = (lat: number, lng: number): boolean => {
  let inside = false;
  for (let i = 0, j = ADAMA_SERVICE_AREA.length - 1; i < ADAMA_SERVICE_AREA.length; j = i++) {
    const xi = ADAMA_SERVICE_AREA[i][0];
    const yi = ADAMA_SERVICE_AREA[i][1];
    const xj = ADAMA_SERVICE_AREA[j][0];
    const yj = ADAMA_SERVICE_AREA[j][1];

    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const MarketplaceMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MARKETPLACE_SELLER' | 'ADMIN_MANAGED' | 'OSM_EXTERNAL'>('ALL');
  
  // Real Live Device/Browser GPS Location state
  const [buyerLocation, setBuyerLocation] = useState<DetectedLocation | null>(null);
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  const [activePlace, setActivePlace] = useState<PlaceItem | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Filtered places computed via useMemo
  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      if (typeFilter !== 'ALL' && p.placeType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchAddress = p.address.toLowerCase().includes(q);
        const matchMaterials = p.materials?.some((m) => m.toLowerCase().includes(q));
        const matchCategory = p.category?.toLowerCase().includes(q);
        if (!matchTitle && !matchAddress && !matchMaterials && !matchCategory) return false;
      }
      return true;
    });
  }, [places, typeFilter, searchQuery]);

  // Fetch Map Places & calculate real road/haversine distance from detected coordinates
  const fetchMapPlaces = async (lat?: number, lng?: number) => {
    try {
      setLoading(true);
      const params: any = {};
      if (lat !== undefined && lng !== undefined) {
        params.buyerLat = lat;
        params.buyerLng = lng;
      }
      const res = await api.get('/map/places', { params });
      if (res.data.success) {
        setPlaces(res.data.places || []);
      }
    } catch (err) {
      console.error('Failed to load map data', err);
      showToast('Could not load map places.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapPlaces();
  }, []);

  // Initialize Leaflet Map once container is mounted
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: ADAMA_CENTER_COORDS,
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Adama Service Area Boundary Polygon Overlay
      L.polygon(ADAMA_SERVICE_AREA, {
        color: '#d97706',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        dashArray: '5, 5',
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Allow user to click anywhere on map to position pin
      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickedLat = Number(e.latlng.lat.toFixed(6));
        const clickedLng = Number(e.latlng.lng.toFixed(6));
        const isInside = isInsideAdamaServiceArea(clickedLat, clickedLng);
        setBuyerLocation({
          lat: clickedLat,
          lng: clickedLng,
          accuracy: 5,
          isInside,
          timestamp: Date.now(),
        });
        fetchMapPlaces(clickedLat, clickedLng);
        if (isInside) {
          showToast(`Location set (${clickedLat}, ${clickedLng}) — Inside Adama`, 'success');
        } else {
          showToast(`Location set (${clickedLat}, ${clickedLng}) — Outside Adama`, 'info');
        }
      });

      // Calibration ticks for proper tile rendering across all viewports
      const timers = [
        setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 100),
        setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 300),
        setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 700),
        setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 1500),
      ];

      const handleResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        timers.forEach(clearTimeout);
        window.removeEventListener('resize', handleResize);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          markersGroupRef.current = null;
        }
      };
    } catch (e) {
      console.error('Error initializing Leaflet map:', e);
    }
  }, []);

  // Update User "You are here" Marker & Accuracy Ring on the map
  const renderUserMarker = useCallback((loc: DetectedLocation) => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    if (userMarkerRef.current) {
      markersGroupRef.current.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }
    if (accuracyCircleRef.current) {
      markersGroupRef.current.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }

    const isInside = loc.isInside;
    const markerColor = isInside ? '#2563eb' : '#dc2626'; // Blue if inside Adama, Red if outside
    const shadowColor = isInside ? 'rgba(37,99,235,0.35)' : 'rgba(220,38,38,0.35)';

    // Accuracy Circle
    if (loc.accuracy && loc.accuracy > 0 && loc.accuracy < 20000) {
      accuracyCircleRef.current = L.circle([loc.lat, loc.lng], {
        radius: loc.accuracy,
        color: markerColor,
        weight: 1,
        fillColor: markerColor,
        fillOpacity: 0.12,
      }).addTo(markersGroupRef.current);
    }

    // Custom Live Radar "You are here" Pin
    const buyerIcon = L.divIcon({
      className: 'custom-buyer-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background-color: ${markerColor}; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="background-color: ${markerColor}; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px ${shadowColor}; border: 3px solid white; z-index: 10; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const popupHtml = `
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 4px; min-width: 180px;">
        <div style="font-weight: 800; color: #0f172a; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
          📍 You are here
        </div>
        <div style="color: #475569;">Latitude: <strong>${loc.lat.toFixed(6)}</strong></div>
        <div style="color: #475569;">Longitude: <strong>${loc.lng.toFixed(6)}</strong></div>
        <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Accuracy: ±${Math.round(loc.accuracy)} meters</div>
        <div style="margin-top: 6px; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; text-align: center; background-color: ${isInside ? '#dcfce7' : '#fee2e2'}; color: ${isInside ? '#15803d' : '#b91c1c'};">
          ${isInside ? '✔ Inside Adama Service Area' : '⛔ Outside Adama Service Area'}
        </div>
      </div>
    `;

    userMarkerRef.current = L.marker([loc.lat, loc.lng], { icon: buyerIcon, zIndexOffset: 1000 })
      .bindPopup(popupHtml)
      .bindTooltip(`You are here (${isInside ? 'Inside Adama' : 'Outside Adama'})`, {
        permanent: false,
        direction: 'top',
        offset: [0, -22],
      })
      .addTo(markersGroupRef.current);
  }, []);

  // Render Marketplace Places Markers
  const renderPlaceMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    // Filtered marketplace places
    filteredPlaces.forEach((place) => {
      let iconHtml = '';
      if (place.placeType === 'MARKETPLACE_SELLER') {
        iconHtml = `
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(217,119,6,0.45); border: 2px solid white; cursor: pointer;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path><path d="M2 7h20"></path></svg>
          </div>
        `;
      } else if (place.placeType === 'ADMIN_MANAGED') {
        iconHtml = `
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(5,150,105,0.45); border: 2px solid white; cursor: pointer;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>
          </div>
        `;
      } else {
        iconHtml = `
          <div style="background: linear-gradient(135deg, #64748b, #475569); color: white; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.25); border: 2px solid white; cursor: pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
        `;
      }

      const placeIcon = L.divIcon({
        className: 'custom-map-marker',
        html: iconHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker(place.coordinates, { icon: placeIcon })
        .bindTooltip(place.title, { direction: 'top', offset: [0, -18] })
        .addTo(markersGroupRef.current!);

      marker.on('click', () => {
        setActivePlace(place);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(place.coordinates, 15);
        }
      });
    });
  }, [filteredPlaces]);

  // Synchronize Markers
  useEffect(() => {
    if (!markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();
    if (buyerLocation) {
      renderUserMarker(buyerLocation);
    }
    renderPlaceMarkers();
  }, [filteredPlaces, buyerLocation, renderUserMarker, renderPlaceMarkers]);

  // Process Geolocation Position Payload
  const processPosition = (pos: GeolocationPosition, isFirstFix = false) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy;

    // Evaluate real coordinates against the Adama polygon
    const isInside = isInsideAdamaServiceArea(lat, lng);

    const locationData: DetectedLocation = {
      lat,
      lng,
      accuracy,
      isInside,
      timestamp: Date.now(),
    };

    setBuyerLocation(locationData);
    setGpsError(null);
    setGpsLoading(false);

    // Refresh distance calculations
    fetchMapPlaces(lat, lng);

    // Move map to the detected real GPS location
    if (mapInstanceRef.current && isFirstFix) {
      mapInstanceRef.current.flyTo([lat, lng], isInside ? 14 : 12, {
        duration: 1.2,
      });
    }

    if (isFirstFix) {
      if (isInside) {
        showToast(`GPS Position: (${lat.toFixed(4)}, ${lng.toFixed(4)}) — Inside Adama City!`, 'success');
      } else {
        showToast(
          `GPS Position: (${lat.toFixed(4)}, ${lng.toFixed(4)}) — Outside Adama Service Area`,
          'info'
        );
      }
    }
  };

  // Process Geolocation Error Payload
  const processGpsError = (err: GeolocationPositionError) => {
    setGpsLoading(false);
    setIsLiveTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    let errorMsg = 'Could not obtain location.';
    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorMsg = 'Location permission was denied. Please enable location access in your browser settings.';
        break;
      case err.POSITION_UNAVAILABLE:
        errorMsg = 'GPS position is unavailable on this device/network.';
        break;
      case err.TIMEOUT:
        errorMsg = 'Location request timed out. Please try again.';
        break;
      default:
        errorMsg = err.message || 'Unknown location error.';
    }
    setGpsError(errorMsg);
    showToast(errorMsg, 'error');
  };

  // 1. One-Time Accurate GPS Request (getCurrentPosition)
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      const err = 'Geolocation is not supported by your browser.';
      setGpsError(err);
      showToast(err, 'error');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => processPosition(pos, true),
      processGpsError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // 2. Continuous Live Location Tracking (watchPosition)
  const handleToggleLiveTracking = () => {
    if (!navigator.geolocation) {
      const err = 'Geolocation is not supported by your browser.';
      setGpsError(err);
      showToast(err, 'error');
      return;
    }

    if (isLiveTracking && watchIdRef.current !== null) {
      // Stop Tracking
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsLiveTracking(false);
      showToast('Live location tracking paused.', 'info');
      return;
    }

    // Start Tracking
    setGpsLoading(true);
    setGpsError(null);
    setIsLiveTracking(true);

    let firstFix = true;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        processPosition(pos, firstFix);
        firstFix = false;
      },
      processGpsError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    watchIdRef.current = watchId;
  };

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Center on Adama City (Pure camera view adjustment, does not alter real GPS)
  const handleCenterAdama = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(ADAMA_CENTER_COORDS, 13, { duration: 1 });
    }
  };

  // Center on User's Detected Location
  const handleCenterUser = () => {
    if (buyerLocation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([buyerLocation.lat, buyerLocation.lng], 15, { duration: 1 });
    }
  };

  // Calculate road directions to selected place
  const handleGetDirections = async (place: PlaceItem) => {
    const originLat = buyerLocation?.lat || ADAMA_CENTER_COORDS[0];
    const originLng = buyerLocation?.lng || ADAMA_CENTER_COORDS[1];

    try {
      setRouteLoading(true);
      const res = await api.get('/map/route', {
        params: {
          fromLat: originLat,
          fromLng: originLng,
          toLat: place.coordinates[0],
          toLng: place.coordinates[1],
        },
      });

      if (res.data.success && res.data.routeGeometry && mapInstanceRef.current) {
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current);
        }

        routeLayerRef.current = L.polyline(res.data.routeGeometry, {
          color: '#2563eb',
          weight: 5,
          opacity: 0.85,
          dashArray: '1, 8',
        }).addTo(mapInstanceRef.current);

        mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), {
          padding: [60, 60],
        });

        setRouteInfo({
          distanceKm: res.data.distanceKm,
          durationMin: res.data.durationMin,
          source: res.data.source,
          targetTitle: place.title,
        });

        showToast(`Route mapped: ${res.data.distanceKm} km (~${res.data.durationMin} mins)`, 'success');
      }
    } catch (err) {
      console.error('Failed to calculate road route', err);
      showToast('Could not calculate road directions.', 'error');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleClearRoute = () => {
    if (mapInstanceRef.current && routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    setRouteInfo(null);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row w-full min-h-[calc(100vh-5rem)] h-full bg-slate-100 relative">
      {/* Left Sidebar: Search, Location Control & Place Directory */}
      <div className="w-full lg:w-96 flex flex-col h-[48vh] lg:h-[calc(100vh-5rem)] bg-white border-r border-slate-200 shadow-md z-20 flex-shrink-0 order-2 lg:order-1">
        {/* Header & Location Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/95 space-y-3 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sellers, scrap, timber, steel..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              All ({places.length})
            </button>
            <button
              onClick={() => setTypeFilter('MARKETPLACE_SELLER')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'MARKETPLACE_SELLER'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              <Store className="w-3 h-3" />
              <span>Sellers</span>
            </button>
            <button
              onClick={() => setTypeFilter('ADMIN_MANAGED')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'ADMIN_MANAGED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>Depots</span>
            </button>
            <button
              onClick={() => setTypeFilter('OSM_EXTERNAL')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                typeFilter === 'OSM_EXTERNAL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>OSM</span>
            </button>
          </div>

          {/* Location Permission Not Enabled Prompt */}
          {!buyerLocation && !gpsLoading && (
            <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-tight">
                  <strong>Location permission is required</strong> to verify Adama service area and calculate delivery distances.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGetCurrentLocation}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Use My Location</span>
                </button>
                <button
                  onClick={handleToggleLiveTracking}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  title="Enable continuous live GPS tracking"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live GPS</span>
                </button>
              </div>
            </div>
          )}

          {/* Live Detected GPS Details Panel */}
          {buyerLocation && (
            <div className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
              buyerLocation.isInside
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/90 border-rose-200 text-rose-950'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isLiveTracking ? 'bg-emerald-500 animate-pulse' : 'bg-blue-600'}`}></span>
                  Your current location {isLiveTracking && '(Live)'}:
                </span>
                {buyerLocation.isInside ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Inside Adama City
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-600" /> Outside Service Area
                  </span>
                )}
              </div>

              {/* Exact Coordinates Box */}
              <div className="text-[11px] font-mono bg-white/95 p-2.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col gap-0.5 text-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Latitude:</span>
                  <span className="font-bold text-slate-900">{buyerLocation.lat.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Longitude:</span>
                  <span className="font-bold text-slate-900">{buyerLocation.lng.toFixed(6)}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px]">
                  <span className="text-slate-500">Accuracy:</span>
                  <span className={`font-bold ${buyerLocation.accuracy > 150 ? 'text-amber-600' : 'text-slate-700'}`}>
                    ±{Math.round(buyerLocation.accuracy)} meters {buyerLocation.accuracy > 150 ? '(Approximate / Network)' : ''}
                  </span>
                </div>
              </div>

              {/* Status Notice */}
              {!buyerLocation.isInside ? (
                <div className="p-2 bg-rose-100/80 rounded-xl border border-rose-200 text-[11px] text-rose-900 leading-tight">
                  <strong>Service Notice:</strong> Your current location ({buyerLocation.lat.toFixed(4)}, {buyerLocation.lng.toFixed(4)}) is outside the Adama service area. AdaMaterials is currently available only in Adama City. Click on the map to place your pin in Adama.
                </div>
              ) : (
                <div className="text-[10px] text-emerald-800 font-medium">
                  ✔ You are inside the Adama service area. Full marketplace shopping & delivery enabled.
                </div>
              )}

              {/* Live Tracking Actions */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={handleCenterUser}
                  className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Navigation className="w-3 h-3 text-blue-600" />
                  <span>Show My Pin</span>
                </button>
                <button
                  onClick={handleToggleLiveTracking}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    isLiveTracking
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  <span>{isLiveTracking ? 'Pause Live' : 'Resume Live'}</span>
                </button>
              </div>
            </div>
          )}

          {/* GPS Error Alert */}
          {gpsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-2 text-[11px] text-rose-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{gpsError}</span>
              </div>
              <button
                onClick={handleGetCurrentLocation}
                className="py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Location Request</span>
              </button>
            </div>
          )}
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading marketplace locations...</div>
          ) : filteredPlaces.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No places match your search criteria.</div>
          ) : (
            filteredPlaces.map((place) => (
              <div
                key={place.id}
                onClick={() => {
                  setActivePlace(place);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView(place.coordinates, 15);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  activePlace?.id === place.id
                    ? 'border-amber-500 bg-amber-50/40 shadow-md ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {place.placeType === 'MARKETPLACE_SELLER' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                        <Store className="w-3 h-3" /> Marketplace Seller
                      </span>
                    )}
                    {place.placeType === 'ADMIN_MANAGED' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Verified Depot
                      </span>
                    )}
                    {place.placeType === 'OSM_EXTERNAL' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> External OSM
                      </span>
                    )}
                  </div>
                  {place.distanceKm !== null && place.distanceKm !== undefined && (
                    <span className="text-[11px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {place.distanceKm} km
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-sm text-slate-900 mt-2">{place.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{place.address}</p>

                {place.materials && place.materials.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {place.materials.slice(0, 3).map((m, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Map Canvas */}
      <div className="flex-1 h-[52vh] lg:h-[calc(100vh-5rem)] min-h-[450px] relative z-10 order-1 lg:order-2 bg-slate-200">
        <div ref={mapContainerRef} className="w-full h-full min-h-[450px]" style={{ width: '100%', height: '100%', minHeight: '450px' }} />

        {/* Floating Top Map Controls */}
        <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-2">
          <button
            onClick={handleGetCurrentLocation}
            disabled={gpsLoading}
            className="px-3.5 py-2 bg-white/95 backdrop-blur-xs hover:bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            <Navigation className={`w-4 h-4 text-blue-600 ${gpsLoading ? 'animate-spin' : ''}`} />
            <span>{buyerLocation ? 'Update GPS' : 'Use My Location'}</span>
          </button>

          <button
            onClick={handleToggleLiveTracking}
            className={`px-3.5 py-2 backdrop-blur-xs rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isLiveTracking
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white/95 hover:bg-white text-slate-800 border-slate-200'
            }`}
          >
            <Radio className={`w-4 h-4 ${isLiveTracking ? 'text-white animate-pulse' : 'text-slate-600'}`} />
            <span>{isLiveTracking ? 'Live Tracking On' : 'Live Tracking'}</span>
          </button>

          <button
            onClick={handleCenterAdama}
            className="px-3.5 py-2 bg-white/95 backdrop-blur-xs hover:bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Compass className="w-4 h-4 text-amber-600" />
            <span>Center Adama</span>
          </button>
        </div>

        {/* Floating Active Place Popup Card */}
        {activePlace && (
          <div className="absolute bottom-6 left-6 right-6 sm:right-auto sm:w-[420px] z-[400] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {activePlace.placeType === 'MARKETPLACE_SELLER' && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-amber-600" /> Marketplace Seller
                    </span>
                  )}
                  {activePlace.placeType === 'ADMIN_MANAGED' && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Depot
                    </span>
                  )}
                  {activePlace.placeType === 'OSM_EXTERNAL' && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-600" /> Community OSM
                    </span>
                  )}
                  {activePlace.isVerified && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setActivePlace(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-black text-slate-900 mt-2.5">{activePlace.title}</h3>
              <p className="text-xs text-slate-600 mt-1">{activePlace.description}</p>

              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-700">{activePlace.address}</span>
                </div>
                {activePlace.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{activePlace.phone}</span>
                  </div>
                )}
                {activePlace.distanceKm !== null && placeWithDistanceKm(activePlace) && (
                  <div className="flex items-center gap-2 text-blue-700 font-bold">
                    <Car className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span>{activePlace.distanceKm} km from your location</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleGetDirections(activePlace)}
                  disabled={routeLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{routeLoading ? 'Calculating Road Route...' : 'Get Road Directions'}</span>
                </button>

                {activePlace.placeType === 'MARKETPLACE_SELLER' && (
                  <button
                    onClick={() => navigate(`/products`)}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>Products ({activePlace.availableProductsCount || 0})</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Route Info Bar */}
        {routeInfo && (
          <div className="absolute top-4 right-4 z-[400] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-400/30">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white">Route to: {routeInfo.targetTitle}</div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-amber-400">{routeInfo.distanceKm} km</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> ~{routeInfo.durationMin} mins drive
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClearRoute}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              title="Clear Route"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper
function placeWithDistanceKm(place: PlaceItem): boolean {
  return place.distanceKm !== null && place.distanceKm !== undefined;
}

export default MarketplaceMapPage;
