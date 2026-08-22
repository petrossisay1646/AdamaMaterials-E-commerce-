import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: { latitude: number; longitude: number; address?: string }) => void;
  initialLat?: number;
  initialLng?: number;
  title?: string;
  subtitle?: string;
}

// Configurable Adama City Service Area Polygon
const ADAMA_POLYGON: [number, number][] = [
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

// Point-in-Polygon check
const isInsideAdama = (lat: number, lng: number): boolean => {
  let inside = false;
  for (let i = 0, j = ADAMA_POLYGON.length - 1; i < ADAMA_POLYGON.length; j = i++) {
    const xi = ADAMA_POLYGON[i][0];
    const yi = ADAMA_POLYGON[i][1];
    const xj = ADAMA_POLYGON[j][0];
    const yj = ADAMA_POLYGON[j][1];

    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  initialLat = 8.5400,
  initialLng = 39.2700,
  title = 'Select Location on Map',
  subtitle = 'Choose a precise pin location within Adama City',
}) => {
  const [lat, setLat] = useState<number>(initialLat);
  const [lng, setLng] = useState<number>(initialLng);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [detectedAddress, setDetectedAddress] = useState<string>('');
  const [geocoding, setGeocoding] = useState<boolean>(false);

  const isValid = isInsideAdama(lat, lng);

  // Reverse Geocoding helper
  const reverseGeocode = async (latitude: number, longitude: number) => {
    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (response.ok) {
        const data = await response.json();
        const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.county || 'Adama';
        const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.road || '';
        const display = suburb ? `${suburb}, ${city}` : (data.display_name?.split(',').slice(0, 2).join(',') || city);
        setDetectedAddress(display);
      }
    } catch {
      // Fallback if offline or network rate limit
      setDetectedAddress(isValid ? 'Adama City Service Area' : 'Outside Adama Area');
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reverseGeocode(lat, lng);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Dynamically initialize Leaflet
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === 'undefined') return;

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
        center: [lat, lng],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add Adama Service Area polygon overlay
      L.polygon(ADAMA_POLYGON, {
        color: '#d97706',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.1,
        dashArray: '5, 5',
      }).addTo(map);

      // Create draggable pin marker with custom icon
      const customIcon = L.divIcon({
        className: 'custom-pin-icon',
        html: `
          <div style="background-color: #f59e0b; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2px solid white; transform: translate(-50%, -50%);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      const marker = L.marker([lat, lng], {
        draggable: true,
        icon: customIcon,
      }).addTo(map);

      marker.on('dragend', (event: any) => {
        const position = event.target.getLatLng();
        setLat(position.lat);
        setLng(position.lng);
        reverseGeocode(position.lat, position.lng);
      });

      map.on('click', (event: any) => {
        const { lat: clickLat, lng: clickLng } = event.latlng;
        marker.setLatLng([clickLat, clickLng]);
        setLat(clickLat);
        setLng(clickLng);
        reverseGeocode(clickLat, clickLng);
      });

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;
    };

    setTimeout(initMap, 150);

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  const handleCenterAdama = () => {
    const adamaLat = 8.5400;
    const adamaLng = 39.2700;
    setLat(adamaLat);
    setLng(adamaLng);
    setGpsError(null);
    if (mapInstanceRef.current && markerInstanceRef.current) {
      mapInstanceRef.current.setView([adamaLat, adamaLng], 14);
      markerInstanceRef.current.setLatLng([adamaLat, adamaLng]);
    }
    reverseGeocode(adamaLat, adamaLng);
  };

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser. You can click on the map to place your pin in Adama.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setLat(newLat);
        setLng(newLng);

        if (mapInstanceRef.current && markerInstanceRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 15);
          markerInstanceRef.current.setLatLng([newLat, newLng]);
        }
        reverseGeocode(newLat, newLng);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(`GPS permission was not granted or location unavailable (${err.message}). Please click on the map to pin your location in Adama.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleConfirm = () => {
    if (!isValid) return;
    onSelectLocation({
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      address: detectedAddress || 'Adama City',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-400/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[380px] bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

          {/* Map Top Action Overlays */}
          <div className="absolute top-4 right-4 z-[400] flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleCenterAdama}
              className="bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Center Adama</span>
            </button>
            <button
              type="button"
              onClick={handleGetCurrentGps}
              disabled={gpsLoading}
              className="bg-white hover:bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Navigation className={`w-4 h-4 text-amber-600 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{gpsLoading ? 'Detecting GPS...' : 'Use My GPS'}</span>
            </button>
          </div>
        </div>

        {/* Footer & Validation Banner */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {isValid ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Inside Adama Service Area ({lat.toFixed(4)}, {lng.toFixed(4)})
                    {detectedAddress && <span className="text-slate-600 font-normal"> — {detectedAddress}</span>}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>
                      Outside Adama Service Area ({lat.toFixed(4)}, {lng.toFixed(4)})
                      {detectedAddress && <span className="font-normal text-rose-800"> [{detectedAddress}]</span>}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    AdaMaterials operates exclusively in Adama City. Click <strong>"Center Adama"</strong> or drag the pin inside the orange service area boundary.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!isValid}
                className="px-5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-xl shadow-md transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                Confirm Location
              </button>
            </div>
          </div>

          {gpsError && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
              {gpsError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;