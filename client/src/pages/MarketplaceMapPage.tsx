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

const ADAMA_CENTER_COORDS: [number, number] = [8.5400, 39.2700];

// Polygon boundary for Adama City Service Area
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

const MarketplaceMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MARKETPLACE_SELLER' | 'ADMIN_MANAGED' | 'OSM_EXTERNAL'>('ALL');
  const [buyerLocation, setBuyerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activePlace, setActivePlace] = useState<PlaceItem | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsOutsideWarning, setGpsOutsideWarning] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const buyerMarkerRef = useRef<L.Marker | null>(null);

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

  // Fetch Map Places & Sellers from API
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

      // Adama Service Area Boundary Polygon
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

      // Ensure tiles render completely after layout stabilizes
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

  // Render Marker Icons on the map
  const renderMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    // 1. User GPS Marker
    if (buyerLocation) {
      const buyerIcon = L.divIcon({
        className: 'custom-buyer-pin',
        html: `
          <div style="background-color: #2563eb; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 6px rgba(37,99,235,0.28); border: 2.5px solid white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      buyerMarkerRef.current = L.marker([buyerLocation.lat, buyerLocation.lng], { icon: buyerIcon })
        .bindTooltip('Your Detected Location', { permanent: false, direction: 'top', offset: [0, -16] })
        .addTo(markersGroupRef.current);
    }

    // 2. Marketplace Place Markers
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
  }, [filteredPlaces, buyerLocation]);

  // Re-run marker rendering whenever places or filters change
  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Handle GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setGpsLoading(true);
    setGpsOutsideWarning(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setBuyerLocation(loc);
        fetchMapPlaces(loc.lat, loc.lng);

        // Check if detected GPS is within Adama coordinates (Lat: ~8.45-8.62, Lng: ~39.18-39.35)
        const isInsideAdama =
          loc.lat >= 8.45 && loc.lat <= 8.62 && loc.lng >= 39.18 && loc.lng <= 39.36;

        if (!isInsideAdama) {
          setGpsOutsideWarning(`Detected location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}) is outside Adama Service Area.`);
          showToast('Detected location is outside Adama service area.', 'info');
        } else {
          showToast('GPS location updated successfully!', 'success');
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([loc.lat, loc.lng], 14);
        }
      },
      (err) => {
        setGpsLoading(false);
        console.warn('Geolocation error:', err.message);
        showToast('Could not obtain GPS permission. Centering Adama City.', 'info');
        handleCenterAdama();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Center Adama
  const handleCenterAdama = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(ADAMA_CENTER_COORDS, 13);
    }
  };

  // Fetch Road Route from user location to place
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
      {/* Left Sidebar: Search & Place Directory */}
      <div className="w-full lg:w-96 flex flex-col h-[42vh] lg:h-[calc(100vh-5rem)] bg-white border-r border-slate-200 shadow-md z-20 flex-shrink-0 order-2 lg:order-1">
        {/* Search & Filter Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/90 space-y-3 flex-shrink-0">
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

          {/* GPS Outside Warning alert */}
          {gpsOutsideWarning && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{gpsOutsideWarning}</span>
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
      <div className="flex-1 h-[58vh] lg:h-[calc(100vh-5rem)] min-h-[450px] relative z-10 order-1 lg:order-2 bg-slate-200">
        <div ref={mapContainerRef} className="w-full h-full min-h-[450px]" style={{ width: '100%', height: '100%', minHeight: '450px' }} />

        {/* Floating Top Map Controls */}
        <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
          <button
            onClick={handleDetectGPS}
            disabled={gpsLoading}
            className="px-3.5 py-2 bg-white/95 backdrop-blur-xs hover:bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            <Navigation className={`w-4 h-4 text-blue-600 ${gpsLoading ? 'animate-spin' : ''}`} />
            <span>{buyerLocation ? 'Update GPS Location' : 'Use My Location'}</span>
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
