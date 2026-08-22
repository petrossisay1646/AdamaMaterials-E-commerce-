import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Store,
  Building2,
  Globe,
  MapPin,
  Navigation,
  Search,
  Layers,
  ArrowUpRight,
  Clock,
  Car,
  X,
  Phone,
  PackageCheck,
  CheckCircle2,
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

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const buyerMarkerRef = useRef<any>(null);

  // Fetch Map Places & Sellers
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
        setPlaces(res.data.places);
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

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      // Ensure leaflet stylesheet is present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const map = L.map(mapContainerRef.current, {
        center: [8.5400, 39.2700], // Adama Center
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Adama Service Area Boundary Polygon
      const ADAMA_SERVICE_AREA = [
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

      L.polygon(ADAMA_SERVICE_AREA as any, {
        color: '#d97706',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        dashArray: '4, 4',
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      renderMarkers();
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Marker Icons on the map
  const renderMarkers = async () => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    const L = (await import('leaflet')).default;

    markersGroupRef.current.clearLayers();

    // 1. Buyer Marker
    if (buyerLocation) {
      const buyerIcon = L.divIcon({
        className: 'buyer-gps-pin',
        html: `
          <div style="background-color: #2563eb; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 6px rgba(37,99,235,0.25); border: 2.5px solid white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      buyerMarkerRef.current = L.marker([buyerLocation.lat, buyerLocation.lng], { icon: buyerIcon })
        .bindTooltip('Your Location', { permanent: false, direction: 'top' })
        .addTo(markersGroupRef.current);
    }

    // 2. Place Markers
    filteredPlaces.forEach((place) => {
      let iconHtml = '';
      if (place.placeType === 'MARKETPLACE_SELLER') {
        iconHtml = `
          <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(217,119,6,0.4); border: 2px solid white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"></path><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"></path><path d="M2 7h20"></path></svg>
          </div>
        `;
      } else if (place.placeType === 'ADMIN_MANAGED') {
        iconHtml = `
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(5,150,105,0.4); border: 2px solid white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>
          </div>
        `;
      } else {
        iconHtml = `
          <div style="background: linear-gradient(135deg, #64748b, #475569); color: white; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.25); border: 2px solid white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
        `;
      }

      const placeIcon = L.divIcon({
        className: 'place-custom-icon',
        html: iconHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker(place.coordinates, { icon: placeIcon }).addTo(markersGroupRef.current);
      marker.on('click', () => {
        setActivePlace(place);
      });
    });
  };

  useEffect(() => {
    renderMarkers();
  }, [places, typeFilter, searchQuery, buyerLocation]);

  // Filter places
  const filteredPlaces = places.filter((p) => {
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

  // Handle GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setBuyerLocation(loc);
        fetchMapPlaces(loc.lat, loc.lng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([loc.lat, loc.lng], 14);
        }
        showToast('Your GPS location detected! Sorting nearby places.', 'success');
      },
      (err) => {
        setGpsLoading(false);
        showToast(`Could not get GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Calculate & Draw Road Route
  const handleGetDirections = async (place: PlaceItem) => {
    if (!buyerLocation) {
      showToast('Please detect or select your GPS location first to get directions.', 'warning');
      handleDetectGPS();
      return;
    }

    setRouteLoading(true);
    try {
      const res = await api.get('/map/route', {
        params: {
          fromLat: buyerLocation.lat,
          fromLng: buyerLocation.lng,
          toLat: place.coordinates[0],
          toLng: place.coordinates[1],
        },
      });

      if (res.data.success) {
        const { distanceKm, durationMin, routeGeometry, source } = res.data;
        setRouteInfo({
          distanceKm,
          durationMin,
          source,
          targetTitle: place.title,
        });

        const L = (await import('leaflet')).default;
        if (mapInstanceRef.current) {
          if (routeLayerRef.current) {
            mapInstanceRef.current.removeLayer(routeLayerRef.current);
          }

          const routePolyline = L.polyline(routeGeometry, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.85,
            smoothFactor: 1,
          }).addTo(mapInstanceRef.current);

          routeLayerRef.current = routePolyline;
          mapInstanceRef.current.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
        }
        showToast(`Road route calculated: ${distanceKm} km (~${durationMin} min drive)`, 'success');
      }
    } catch (err: any) {
      showToast('Failed to calculate road route.', 'error');
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-65px)] overflow-hidden bg-slate-100">
      {/* Left Sidebar: Controls & Place Directory */}
      <div className="w-full lg:w-96 flex flex-col bg-white border-r border-slate-200 shadow-lg z-10">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 space-y-3">
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
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading map places...</div>
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
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Floating Top Map Controls */}
        <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
          <button
            onClick={handleDetectGPS}
            disabled={gpsLoading}
            className="px-3.5 py-2 bg-white/95 backdrop-blur-xs hover:bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-60"
          >
            <Navigation className={`w-4 h-4 text-blue-600 ${gpsLoading ? 'animate-spin' : ''}`} />
            <span>{buyerLocation ? 'Update GPS Location' : 'Detect My GPS'}</span>
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
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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
                {activePlace.distanceKm !== null && activePlace.distanceKm !== undefined && (
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
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
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

export default MarketplaceMapPage;