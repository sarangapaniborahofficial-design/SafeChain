import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Bell, Moon, TriangleAlert, Building, Users, Map as MapIcon, Home, User, LayoutGrid, Navigation } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Mapbox token placeholder
const MAPBOX_TOKEN = '';

// Coordinates
const astu: [number, number] = [26.1380, 91.6591];
const police: [number, number] = [26.1390, 91.6575]; // Placed smoothly on route to PG
const market: [number, number] = [26.1398, 91.6565]; // Placed smoothly on route to PG
const defaultPg: [number, number] = [26.140224, 91.65536]; // Exact from user screenshot!

const demoLocations = [
  { name: "Trinayan Boys PG", coords: [26.1438, 91.6615] as [number, number], type: "PG" },
  { name: "Rupalaya Girl's PG", coords: [26.140224, 91.65536] as [number, number], type: "PG" },
  { name: "Assam Engineering College (AEC)", coords: [26.1415, 91.6565] as [number, number], type: "College" },
  { name: "AEC Daily Market", coords: [26.1430, 91.6640] as [number, number], type: "Market" }
];

// Custom Icons
const createIcon = (html: string) => L.divIcon({
  className: 'custom-icon',
  html,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -17]
});

const startIcon = createIcon('<div class="marker-start"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>');
const destIcon = createIcon('<div class="glowing-marker marker-alert"></div>');
const policeIcon = createIcon('<div class="radar-ring safe"></div><div class="glowing-marker marker-brand"></div>');
const marketIcon = createIcon('<div class="radar-ring safe"></div><div class="glowing-marker marker-safe"></div>');

// Helper to fit bounds
function MapController({ bounds, nightMode }: { bounds: L.LatLngBoundsExpression | null, nightMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [60, 150], animate: true, duration: 1 });
    }
  }, [bounds, map]);

  useEffect(() => {
    if (nightMode) {
      map.getContainer().classList.add('night-mode-map');
    } else {
      map.getContainer().classList.remove('night-mode-map');
    }
  }, [nightMode, map]);

  return null;
}

export default function App() {
  const [currentStart, setCurrentStart] = useState<[number, number]>(astu);
  const [destination, setDestination] = useState<{name: string, coords: [number, number]}>({ name: "Rupalaya Girl's PG", coords: defaultPg });
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  
  const [safeRoute, setSafeRoute] = useState<{ latlngs: [number, number][], distanceKm: string, durationMin: string } | null>(null);
  const [shortcutRoute, setShortcutRoute] = useState<{ latlngs: [number, number][] } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'safe' | 'shortcut'>('safe');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  
  const [showSOS, setShowSOS] = useState(false);
  const [sosLoading, setSosLoading] = useState<'police' | 'contacts' | null>(null);
  
  const [navigating, setNavigating] = useState(false);

  // Routing Effect
  useEffect(() => {
    async function fetchRoutes() {
      const end = destination.coords;
      let waypointsToUse: [number, number][] = [];
      if (destination.name.includes('PG') || destination.name.includes('College') || destination.name.includes('Market')) {
          waypointsToUse = [police, market];
      }

      // Safe Route
      const safeData = await fetchRealRoute(currentStart, end, waypointsToUse);
      setSafeRoute(safeData);

      // Shortcut Route (Danger detour)
      let shortcutWaypoints: [number, number][] = [];
      if (waypointsToUse.length > 0) shortcutWaypoints = [[26.1395, 91.6585]];
      
      const shortData = await fetchRealRoute(currentStart, end, shortcutWaypoints);
      setShortcutRoute(shortData);
      
      // Reset navigation if active
      setNavigating(false);
      setCurrentStart(astu); // reset to ASTU for demo purposes
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
        if (currentStep >= safeRoute.latlngs.length) {
          clearInterval(interval);
          setNavigating(false);
          if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance("You have arrived safely."));
          return;
        }
        setCurrentStart(safeRoute.latlngs[currentStep]);
      }, 600);
    }
    return () => clearInterval(interval);
  }, [navigating, safeRoute]);

  async function fetchRealRoute(start: [number, number], end: [number, number], waypoints: [number, number][]) {
    // OSRM expects Lng, Lat
    const startStr = `${start[1]},${start[0]}`;
    const endStr = `${end[1]},${end[0]}`;
    const wpStr = waypoints.map(p => `${p[1]},${p[0]}`).join(';');
    let url = `https://router.project-osrm.org/route/v1/walking/${startStr};${wpStr ? wpStr + ';' : ''}${endStr}?overview=full&geometries=geojson`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const geojson = data.routes[0].geometry;
        const distanceKm = (data.routes[0].distance / 1000).toFixed(1);
        const durationMin = Math.ceil(data.routes[0].duration / 60).toString();
        const latlngs = geojson.coordinates.map((c: any[]) => [c[1], c[0]] as [number, number]);
        return { latlngs, distanceKm, durationMin };
      }
    } catch (e) { console.error(e); }
    
    // Fallback
    const fallback = [start, ...waypoints, end];
    return { latlngs: fallback, distanceKm: '--', durationMin: '--' };
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.length > 1) {
      const matches = demoLocations.filter(d => d.name.toLowerCase().includes(q.toLowerCase()));
      setSuggestions(matches.length > 0 ? matches : [{ name: `Search web for "${q}"`, isWeb: true, query: q }]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSearchResult = async (item: any) => {
    setShowSuggestions(false);
    if (item.isWeb) {
      setIsSearching(true);
      try {
        if (MAPBOX_TOKEN) {
          const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(item.query)}.json?access_token=${MAPBOX_TOKEN}&proximity=${currentStart[1]},${currentStart[0]}&country=in`);
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            setDestination({ name: data.features[0].text, coords: [data.features[0].center[1], data.features[0].center[0]] });
          } else alert("Not found.");
        } else {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(item.query + ', Guwahati, Assam')}`);
          const data = await res.json();
          if (data && data.length > 0) {
            setDestination({ name: data[0].display_name.split(',')[0], coords: [parseFloat(data[0].lat), parseFloat(data[0].lon)] });
          } else alert("Not found.");
        }
      } catch (e) { alert("Search error."); }
      setIsSearching(false);
    } else {
      setDestination({ name: item.name, coords: item.coords });
      setSearchQuery(item.name);
    }
  };

  const triggerSOS = (target: 'police' | 'contacts') => {
    setSosLoading(target);
    // Mock API Call
    setTimeout(() => {
      setSosLoading(null);
      setShowSOS(false);
    }, 2000);
  };

  const shareLocation = () => {
    const textToShare = `Track my live location on ASTU NavShield. I am at Lat: ${currentStart[0].toFixed(4)}, Lng: ${currentStart[1].toFixed(4)}`;
    if (navigator.share) {
      navigator.share({ title: 'ASTU NavShield', text: textToShare, url: window.location.href }).catch(console.error);
    } else {
      navigator.clipboard.writeText(textToShare);
      alert("Link copied to clipboard!");
    }
  };

  const bounds = safeRoute ? L.latLngBounds(safeRoute.latlngs) : null;

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
          <button onClick={() => setNightMode(!nightMode)} className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition-colors shadow-sm">
            <Moon size={16} />
          </button>
          <button onClick={shareLocation} className="w-10 h-10 rounded-full bg-green-50 text-safe hover:bg-green-100 flex items-center justify-center transition-colors shadow-sm">
            <MapPin size={16} />
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
          <ul className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-50">
            {suggestions.map((s, i) => (
              <li key={i} onClick={() => selectSearchResult(s)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-brand flex-shrink-0">
                  <MapPin size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-dark font-bold text-[14px] leading-tight">{s.name}</span>
                  {!s.isWeb && <span className="text-gray-400 font-medium text-[11px]">{s.type} • Guwahati</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div className="w-full h-full z-0 relative">
        <MapContainer center={currentStart} zoom={15} zoomControl={false} attributionControl={false} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" maxZoom={20} />
          <MapController bounds={bounds} nightMode={nightMode} />
          
          <Marker position={currentStart} icon={startIcon}>
            <Popup>Start</Popup>
          </Marker>
          <Marker position={police} icon={policeIcon}>
            <Popup>Police Outpost</Popup>
          </Marker>
          <Marker position={market} icon={marketIcon}>
            <Popup>Daily Market</Popup>
          </Marker>
          <Marker position={destination.coords} icon={destIcon}>
            <Popup>Destination: {destination.name}</Popup>
          </Marker>

          {safeRoute && (
            <Polyline 
              positions={safeRoute.latlngs} 
              pathOptions={{ color: activeTab === 'safe' ? '#3b82f6' : '#9ca3af', weight: activeTab === 'safe' ? 7 : 4, opacity: activeTab === 'safe' ? 1 : 0.3, lineJoin: 'round', lineCap: 'round' }} 
            />
          )}
          {shortcutRoute && (
            <Polyline 
              positions={shortcutRoute.latlngs} 
              pathOptions={{ color: activeTab === 'shortcut' ? '#ef4444' : '#fca5a5', weight: activeTab === 'shortcut' ? 7 : 4, dashArray: '8, 8', opacity: activeTab === 'shortcut' ? 1 : 0.4, lineJoin: 'round' }} 
            />
          )}
        </MapContainer>
      </div>

      {/* Bottom Sheet */}
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
                      <p className="text-[10px] text-gray-500 font-medium leading-none">Dynamic AI Rating</p>
                    </div>
                  </div>
                  <span className={cn("text-[20px] font-black", activeTab === 'safe' ? 'text-safe' : 'text-alert')}>{activeTab === 'safe' ? '88/100' : '42/100'}</span>
                </div>
                {/* Additional metrics can go here */}
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

      {/* Dock */}
      <div className="absolute bottom-0 left-0 right-0 z-[100] bg-white h-[80px] flex justify-between items-center px-8 border-t border-gray-100">
        <Home className="text-gray-400" size={24} />
        <div className="relative text-brand">
          <MapIcon size={24} />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-brand rounded-full"></div>
        </div>
        <LayoutGrid className="text-gray-400" size={24} />
        <User className="text-gray-400" size={24} />
      </div>

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
              <button onClick={() => triggerSOS('police')} className="w-full bg-alert text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                {sosLoading === 'police' ? "Dispatched!" : <><Building size={18} /> Alert Police Outpost</>}
              </button>
              <button onClick={() => triggerSOS('contacts')} className="w-full bg-orange-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
                {sosLoading === 'contacts' ? "Dispatched!" : <><Users size={18} /> Alert Trusted Contacts</>}
              </button>
              <button onClick={() => setShowSOS(false)} className="w-full bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl mt-2">
                Cancel False Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
