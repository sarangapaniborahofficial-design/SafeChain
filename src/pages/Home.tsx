import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Search, MapPin, Bell, Moon, TriangleAlert, Building, Users, Map as MapIcon, Home as HomeIcon, User, LayoutGrid, Navigation } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import mapboxgl from 'mapbox-gl';
import { io } from 'socket.io-client';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Initialize Socket.io (does not connect until SOS is pressed)
const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}`, { autoConnect: false });

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Coordinates as [longitude, latitude] for Mapbox consistency
const astu: [number, number] = [91.6591, 26.1380];

export default function Home() {
  const mapRef = useRef<MapRef>(null);
  
  const [currentStart, setCurrentStart] = useState<[number, number]>(astu);
  const [destination, setDestination] = useState<{name: string, coords: [number, number]} | null>(null);
  
  const [viewState, setViewState] = useState({
    longitude: astu[0],
    latitude: astu[1],
    zoom: 15,
    pitch: 45,
    bearing: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  
  const [safeRoute, setSafeRoute] = useState<any>(null);
  const [shortcutRoute, setShortcutRoute] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'safe' | 'shortcut'>('safe');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  
  const [showSOS, setShowSOS] = useState(false);
  const [sosLoading, setSosLoading] = useState<'police' | 'contacts' | null>(null);
  
  const [navigating, setNavigating] = useState(false);
  const [liveTrackingId, setLiveTrackingId] = useState<string | null>(null);
  
  // Hazard Reporting
  const [isReporting, setIsReporting] = useState(false);
  const [hazards, setHazards] = useState<any[]>([]);
  const [hazardModal, setHazardModal] = useState<{ lat: number, lng: number } | null>(null);

  // Ask for user's real GPS location on load
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setCurrentStart([longitude, latitude]);
          setViewState(prev => ({ ...prev, longitude, latitude }));
        },
        (error) => {
          console.error("Error getting location. Falling back to default.", error);
        }
      );
    }
  }, []);

  // Fetch active hazards from the backend on load
  useEffect(() => {
    async function loadHazards() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reports/active`);
        const data = await res.json();
        if (data.hazards) setHazards(data.hazards);
      } catch (e) {
        console.error("Failed to load hazards", e);
      }
    }
    loadHazards();
  }, []);

  const dispatchSOS = async (target: 'police' | 'contacts') => {
    setSosLoading(target);
    const token = localStorage.getItem('safechain_token');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/sos/dispatch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ target, location: { lat: currentStart[1], lng: currentStart[0] } })
      });
      const data = await res.json();
      
      if (data.trackingId) {
        setLiveTrackingId(data.trackingId);
        socket.connect();
        socket.emit('update_location', { 
          trackingId: data.trackingId, 
          location: { lat: currentStart[1], lng: currentStart[0] },
          battery: '42%', speed: '0 km/h'
        });
      }
    } catch (e) {
      console.error('Failed to dispatch SOS', e);
    }
    
    setTimeout(() => { setSosLoading(null); setShowSOS(false); setNavigating(true); }, 1500);
  };

  // Real-time Mapbox Autocomplete Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&proximity=${currentStart[0]},${currentStart[1]}&country=in&autocomplete=true&limit=5`);
          const data = await res.json();
          
          // Inject critical local landmarks that Mapbox might miss
          const localLandmarks = [
            { name: "ASTU Campus", address: "Assam Science and Technology University, Guwahati", coords: [91.6591, 26.1380] },
            { name: "Rupalaya Girl's PG", address: "Tetelia, Guwahati", coords: [91.65536, 26.140224] },
            { name: "Assam Engineering College (AEC)", address: "Jalukbari, Guwahati", coords: [91.6565, 26.1415] },
            { name: "Guwahati University", address: "Jalukbari, Guwahati", coords: [91.6627, 26.1533] }
          ];
          
          const localMatches = localLandmarks.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
          
          let mapboxResults = [];
          if (data.features) {
            mapboxResults = data.features.map((f: any) => ({
              name: f.text,
              address: f.place_name,
              coords: f.center
            }));
          }
          
          // Combine local hits with Mapbox results (local gets priority)
          setSuggestions([...localMatches, ...mapboxResults]);
          setShowSuggestions(true);
        } catch (e) {
          console.error("Geocoding failed", e);
        }
        setIsSearching(false);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentStart]);

  // Routing Effect using Mapbox Directions API
  useEffect(() => {
    async function fetchRoutes() {
      if (!destination) return;
      const end = destination.coords;
      // We drop the hardcoded logic. Let's use the current coordinates for a raw route.
      // In Phase 4, we will query DB for waypoints to avoid/pass through.
      let waypointsToUse: [number, number][] = [];

      // Safe Route
      const safeData = await fetchMapboxRoute(currentStart, end, waypointsToUse);
      setSafeRoute(safeData);

      // Shortcut Route (Danger detour simulation for UI purposes)
      let shortcutWaypoints: [number, number][] = [[91.6585, 26.1395]]; 
      const shortData = await fetchMapboxRoute(currentStart, end, shortcutWaypoints);
      setShortcutRoute(shortData);
      
      setNavigating(false);
      
      if (safeData?.geometry && mapRef.current) {
        // Automatically fit bounds to the route
        const coordinates = safeData.geometry.coordinates;
        const bounds = coordinates.reduce((bounds: any, coord: any) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        mapRef.current.fitBounds(bounds, { padding: 80, duration: 1000 });
      }
    }
    fetchRoutes();
  }, [destination]);

  // Simulation Effect
  useEffect(() => {
    let interval: any;
    if (navigating && safeRoute) {
      let currentStep = 0;
      interval = setInterval(() => {
        currentStep += 3;
        const coords = safeRoute.geometry.coordinates;
        if (currentStep >= coords.length) {
          clearInterval(interval);
          setNavigating(false);
          if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance("You have arrived safely."));
          return;
        }
        const nextCoord = coords[currentStep];
        setCurrentStart([nextCoord[0], nextCoord[1]]);
        
        // Broadcast Live Location to WebSockets if tracking is active
        if (liveTrackingId && socket.connected) {
          socket.emit('update_location', {
            trackingId: liveTrackingId,
            location: { lat: nextCoord[1], lng: nextCoord[0] }, // Mapbox gives [lng, lat]
            battery: '42%',
            speed: '12 km/h'
          });
        }
        
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [nextCoord[0], nextCoord[1]], zoom: 17, pitch: 60, duration: 600 });
        }
      }, 600);
    }
    return () => clearInterval(interval);
  }, [navigating, safeRoute]);

  async function fetchMapboxRoute(start: [number, number], end: [number, number], waypoints: [number, number][]) {
    const coords = [start, ...waypoints, end].map(p => `${p[0]},${p[1]}`).join(';');
    // Use driving profile to ensure realistic transit times instead of walking
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          geometry: route.geometry,
          distanceKm: (route.distance / 1000).toFixed(1),
          durationMin: Math.ceil(route.duration / 60).toString()
        };
      }
    } catch (e) { console.error(e); }
    return null;
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const selectSearchResult = (item: any) => {
    setShowSuggestions(false);
    setDestination({ name: item.name, coords: item.coords });
    setSearchQuery(item.name);
  };

  const submitHazard = async (type: string) => {
    if (!hazardModal) return;
    
    const payload = {
      type,
      location: { lat: hazardModal.lat, lng: hazardModal.lng },
      severity: "high"
    };

    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reports/hazard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setHazards([...hazards, payload]);
    } catch (e) {
      console.error(e);
    }
    
    setHazardModal(null);
    setIsReporting(false);
  };

  const onMapClick = (e: any) => {
    if (isReporting) {
      setHazardModal({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    }
  };

  const calculateScores = (dist: number, isSafeRoute: boolean, routeCoords: any[] = []) => {
    let baseScore = 100;
    baseScore -= Math.min(dist * 5, 30);
    if (nightMode) baseScore -= 15;
    baseScore += isSafeRoute ? 20 : 0;
    baseScore -= !isSafeRoute ? 25 : 0;

    // 4. Crowdsourced Hazard Penalty!
    if (routeCoords && routeCoords.length > 0 && hazards.length > 0) {
      let hazardPenalty = 0;
      hazards.forEach(h => {
        const threshold = 0.001; // Approx 100m radius bounding box
        for (let coord of routeCoords) {
          if (Math.abs(coord[0] - h.location.lng) < threshold && 
              Math.abs(coord[1] - h.location.lat) < threshold) {
            hazardPenalty += 40; // Massive penalty for crossing a hazard
            break; 
          }
        }
      });
      baseScore -= hazardPenalty;
    }

    return Math.max(0, Math.min(100, Math.round(baseScore)));
  };

  const safeDist = safeRoute ? parseFloat(safeRoute.distanceKm) : 0;
  const shortDist = shortcutRoute ? parseFloat(shortcutRoute.distanceKm) : 0;
  
  const safeScore = calculateScores(safeDist, true, safeRoute?.geometry?.coordinates || []);
  const shortScore = calculateScores(shortDist, false, shortcutRoute?.geometry?.coordinates || []);

  const getTransitRecommendation = (dist: number, score: number) => {
    if (score < 50) return "Cab / Uber Required";
    if (dist > 3.0) return "Cab / Uber";
    if (dist > 1.2) return "Shared Auto";
    return "Walk in Group";
  };

  const mapStyle = nightMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12';

  return (
    <div className="relative w-full h-screen max-w-[430px] mx-auto bg-white sm:my-8 sm:h-[90vh] sm:rounded-[40px] sm:shadow-[0_0_50px_rgba(0,0,0,0.2)] sm:border-[8px] sm:border-gray-900 overflow-hidden font-sans">
      
      {/* Header */}
      <div className="absolute top-[48px] sm:top-[20px] left-4 right-4 z-[100] bg-white/90 backdrop-blur-md rounded-full p-2 flex items-center justify-between shadow-lg border border-white/50">
        <div className="flex items-center gap-3 pl-1">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-brand border border-blue-100 shadow-inner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-dark font-bold text-[14px] leading-tight">ASTU Campus</span>
            <span className="text-[11px] font-semibold text-safe flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-safe rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span> Protected
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsReporting(!isReporting)} className={cn("px-3 py-2.5 rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1", isReporting ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
            <TriangleAlert size={14} /> {isReporting ? 'Tap Map to Drop' : 'Report'}
          </button>
          <button onClick={() => setNightMode(!nightMode)} className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm">
            <Moon size={16} />
          </button>
          <button onClick={() => setShowSOS(true)} className="bg-alert text-white px-4 py-2.5 rounded-full text-[13px] font-bold shadow-[0_4px_12px_rgba(239,68,68,0.4)] hover:bg-red-600 active:scale-95 transition-all flex items-center">
            <Bell size={14} className="mr-1" /> SOS
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="absolute top-[120px] sm:top-[90px] left-4 right-4 z-[100]">
        <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center p-3">
          <Search className="text-gray-400 ml-2" size={20} />
          <input 
            type="text" 
            placeholder="Where do you want to go safely?" 
            className="w-full bg-transparent border-none outline-none px-3 text-[15px] font-medium text-dark placeholder-gray-400"
            value={searchQuery}
            onChange={handleSearch}
          />
          {isSearching && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand mr-2"></div>}
        </div>
        
        {showSuggestions && (
          <ul className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-50 max-h-[300px] overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i} onClick={() => selectSearchResult(s)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-brand flex-shrink-0">
                  <MapPin size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-dark font-bold text-[14px] leading-tight">{s.name}</span>
                  <span className="text-gray-400 font-medium text-[11px] truncate w-[250px]">{s.address}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mapbox Map */}
      <div className="w-full h-full z-0 relative">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          {...viewState}
          onMove={(evt: any) => setViewState(evt.viewState)}
          onClick={onMapClick}
          mapStyle={mapStyle}
          attributionControl={false}
          pitch={60}
          terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
        >
          {/* Add 3D Terrain Source */}
          <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
          
          {/* Add 3D Buildings Layer */}
          <Layer 
            id="3d-buildings"
            source="composite"
            source-layer="building"
            filter={['==', 'extrude', 'true']}
            type="fill-extrusion"
            minzoom={15}
            paint={{
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.6
            }}
          />

          <Marker longitude={currentStart[0]} latitude={currentStart[1]}>
            <div className="marker-start"><MapPin fill="white" size={16} /></div>
          </Marker>
          
          {destination && (
            <Marker longitude={destination.coords[0]} latitude={destination.coords[1]}>
              <div className="glowing-marker marker-alert"></div>
            </Marker>
          )}

          {/* Render Hazards */}
          {hazards.map((h, i) => (
            <Marker key={i} longitude={h.location.lng} latitude={h.location.lat}>
              <div className="w-8 h-8 bg-black rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 shadow-lg relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
                <TriangleAlert size={14} />
              </div>
            </Marker>
          ))}

          {/* Safe Route */}
          {safeRoute && (
            <Source id="safeRoute" type="geojson" data={{ type: 'Feature', properties: {}, geometry: safeRoute.geometry }}>
              <Layer
                id="safeRouteLine"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': activeTab === 'safe' ? '#3b82f6' : '#9ca3af', 'line-width': activeTab === 'safe' ? 7 : 4, 'line-opacity': activeTab === 'safe' ? 1 : 0.3 }}
              />
            </Source>
          )}

          {/* Shortcut Route */}
          {shortcutRoute && (
            <Source id="shortcutRoute" type="geojson" data={{ type: 'Feature', properties: {}, geometry: shortcutRoute.geometry }}>
              <Layer
                id="shortcutRouteLine"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': activeTab === 'shortcut' ? '#ef4444' : '#fca5a5', 'line-width': activeTab === 'shortcut' ? 7 : 4, 'line-dasharray': [2, 2], 'line-opacity': activeTab === 'shortcut' ? 1 : 0.4 }}
              />
            </Source>
          )}
        </Map>
      </div>

      {/* Bottom Sheet */}
      {destination && (
        <div className="absolute bottom-[90px] left-4 right-4 z-[100]">
          <div className="bg-white/95 backdrop-blur-xl rounded-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden">
          <div onClick={() => setSheetExpanded(!sheetExpanded)} className="w-full pt-3 pb-1 cursor-pointer flex flex-col items-center">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1"></div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{sheetExpanded ? 'TAP TO COLLAPSE' : 'TAP TO EXPAND'}</span>
          </div>
          
          <div className="px-5 pb-5">
            <div className="flex justify-between items-end mb-3 px-1">
              <div className="flex flex-col">
                <span className="text-[26px] font-black text-dark tracking-tight leading-none">{safeRoute?.durationMin || '--'} min</span>
                <span className="text-[12px] font-bold text-gray-400 mt-1">{safeRoute?.distanceKm || '--'} km away</span>
              </div>
              <div className="bg-green-50 text-safe px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1 border border-green-100 shadow-sm">
                Safest
              </div>
            </div>

            <div className="flex gap-2 mb-4 bg-gray-100/80 p-1 rounded-2xl border border-gray-100/50">
              <button onClick={() => setActiveTab('safe')} className={cn("flex-1 py-2.5 px-2 rounded-xl text-[13px] font-bold transition-all text-center", activeTab === 'safe' ? "bg-dark text-white shadow-sm" : "bg-transparent text-gray-500 hover:text-dark")}>Safe Route</button>
              <button onClick={() => setActiveTab('shortcut')} className={cn("flex-1 py-2.5 px-2 rounded-xl text-[13px] font-bold transition-all text-center", activeTab === 'shortcut' ? "bg-dark text-white shadow-sm" : "bg-transparent text-gray-500 hover:text-dark")}>Shortcut</button>
            </div>

            <div className={cn("transition-all duration-300 origin-top overflow-hidden", sheetExpanded ? "h-[200px] overflow-y-auto no-scrollbar" : "h-0")}>
              <div className="space-y-3 px-1 pb-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm", activeTab === 'safe' ? 'bg-safe' : 'bg-alert')}>
                      <TriangleAlert size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-dark leading-none mb-1">Safety Score</p>
                      <p className="text-[10px] text-gray-500 font-medium leading-none">Deterministic AI Engine</p>
                    </div>
                  </div>
                  <span className={cn("text-[20px] font-black", activeTab === 'safe' ? 'text-safe' : 'text-alert')}>{activeTab === 'safe' ? `${safeScore}/100` : `${shortScore}/100`}</span>
                </div>
                
                {/* Transit Recommendation */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-brand shadow-sm">
                      <Navigation size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-dark leading-none mb-1">Recommended Transit</p>
                      <p className="text-[10px] text-gray-500 font-medium leading-none">Based on distance & safety</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-bold text-dark">{activeTab === 'safe' ? getTransitRecommendation(safeDist, safeScore) : getTransitRecommendation(shortDist, shortScore)}</span>
                </div>
              </div>
            </div>

            <button onClick={() => {
              setSheetExpanded(false);
              setNavigating(true);
              if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance("Starting safe navigation mode."));
            }} className={cn("w-full mt-3 font-bold py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2", sheetExpanded ? "block" : "hidden", navigating ? "bg-safe text-white" : "bg-brand text-white hover:bg-blue-600")}>
              {navigating ? "Navigating..." : <><Navigation size={18} /> Start Safe Navigation</>}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Dock */}
      <div className="absolute bottom-0 left-0 right-0 z-[100] bg-white h-[80px] flex justify-between items-center px-8 border-t border-gray-100">
        <HomeIcon className="text-gray-400" size={24} />
        <div className="relative text-brand">
          <MapIcon size={24} />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-brand rounded-full"></div>
        </div>
        <LayoutGrid className="text-gray-400" size={24} />
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
          <User className="text-gray-400 hover:text-alert transition-colors" size={24} />
        </button>
      </div>

      {/* Hazard Modal */}
      {hazardModal && (
        <div className="absolute inset-0 z-[200] bg-dark/80 backdrop-blur-sm flex items-center justify-center px-5">
          <div className="bg-white w-full rounded-[32px] p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
              <TriangleAlert size={32} />
            </div>
            <h2 className="text-[22px] font-black text-dark mb-1 leading-tight">Report Hazard</h2>
            <p className="text-[13px] text-gray-500 mb-6 font-medium leading-relaxed px-2">
              Drop a pin to alert other users and actively divert the Safe Routing engine away from this area.
            </p>
            <div className="space-y-3">
              <button onClick={() => submitHazard('Unlit Street')} className="w-full bg-dark text-white font-bold py-3.5 rounded-xl">Unlit Street / No Lights</button>
              <button onClick={() => submitHazard('Bad Crowd')} className="w-full bg-dark text-white font-bold py-3.5 rounded-xl">Suspicious Group / Bad Crowd</button>
              <button onClick={() => submitHazard('Stray Dogs')} className="w-full bg-dark text-white font-bold py-3.5 rounded-xl">Aggressive Stray Dogs</button>
              <button onClick={() => setHazardModal(null)} className="w-full bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl mt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Modal */}
      {showSOS && (
        <div className="absolute inset-0 z-[200] bg-dark/80 backdrop-blur-sm flex items-center justify-center px-5">
          <div className="bg-white w-full rounded-[32px] p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-ping"></div>
              <TriangleAlert className="text-alert" size={32} />
            </div>
            <h2 className="text-[22px] font-black text-dark mb-1 leading-tight">EMERGENCY SOS</h2>
            <p className="text-[13px] text-gray-500 mb-6 font-medium leading-relaxed px-2">
              Dispatch your precise live location and route to authorities or trusted contacts immediately.
            </p>
            <div className="space-y-3">
              <button onClick={() => dispatchSOS('police')} className="w-full bg-alert text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                {sosLoading === 'police' ? "Dispatched!" : <><Building size={18} /> Alert Police Outpost</>}
              </button>
              <button onClick={() => dispatchSOS('contacts')} className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                {sosLoading === 'contacts' ? "Dispatched!" : <><Users size={18} /> Alert Trusted Contacts</>}
              </button>
              <button onClick={() => {
                setShowSOS(false);
                if (socket.connected) {
                  socket.disconnect();
                  setLiveTrackingId(null);
                }
              }} className="w-full bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl mt-2">
                Cancel False Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
