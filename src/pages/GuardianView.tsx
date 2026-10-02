import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Map, { Marker } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Activity, ShieldAlert, Battery, Zap, Phone, Car } from 'lucide-react';
import { io } from 'socket.io-client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function GuardianView() {
  const { id } = useParams<{ id: string }>();
  const mapRef = useRef<MapRef>(null);

  const [connected, setConnected] = useState(false);
  const [liveData, setLiveData] = useState<{ lat: number; lng: number; battery: string; speed: string; timestamp: string } | null>(null);

  useEffect(() => {
    // Connect to WebSocket Server
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000");

    socket.on('connect', () => {
      setConnected(true);
      // Join the specific tracking room based on the URL parameter
      socket.emit('join_tracking_room', id);
    });

    socket.on('location_update', (data: any) => {
      setLiveData({
        lat: data.location.lat,
        lng: data.location.lng,
        battery: data.battery,
        speed: data.speed,
        timestamp: data.timestamp
      });
      
      // Auto-pan the map to follow the user smoothly
      if (mapRef.current) {
        mapRef.current.flyTo({ center: [data.location.lng, data.location.lat], zoom: 18, pitch: 45, duration: 800 });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [id]);

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden font-sans flex items-center justify-center">
      {/* Desktop/Tablet wrapper for realistic Guardian UI */}
      <div className="w-full h-full max-w-5xl mx-auto bg-white sm:my-8 sm:h-[90vh] sm:rounded-3xl sm:shadow-2xl overflow-hidden relative border border-gray-200">
        
        {/* Header Dashboard */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100 p-4 sm:px-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-alert/10 rounded-full flex items-center justify-center text-alert shadow-inner relative">
              <div className="absolute inset-0 rounded-full bg-alert/20 animate-ping"></div>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-dark leading-none mb-1">SafeChain Guardian Command</h1>
              <p className="text-sm font-semibold text-gray-500">Live Tracking Session: <span className="font-mono text-gray-800">{id}</span></p>
            </div>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <div className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${connected ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              <Activity size={16} className={connected ? 'animate-pulse' : ''} />
              {connected ? 'Signal Active' : 'Signal Lost'}
            </div>
            {liveData && (
              <>
                <div className="px-4 py-2 rounded-full bg-gray-50 text-gray-700 font-bold text-sm border border-gray-200 flex items-center gap-2 whitespace-nowrap">
                  <Battery size={16} className="text-brand" /> {liveData.battery}
                </div>
                <div className="px-4 py-2 rounded-full bg-gray-50 text-gray-700 font-bold text-sm border border-gray-200 flex items-center gap-2 whitespace-nowrap">
                  <Car size={16} className="text-blue-500" /> {liveData.speed}
                </div>
              </>
            )}
            <button className="px-4 py-2 rounded-full bg-dark text-white font-bold text-sm shadow-md hover:bg-gray-800 transition flex items-center gap-2">
              <Phone size={16} /> Contact Police
            </button>
          </div>
        </div>

        {/* Mapbox Map */}
        <div className="w-full h-full pt-[90px] sm:pt-[80px]">
          {liveData ? (
            <Map
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                longitude: liveData.lng,
                latitude: liveData.lat,
                zoom: 17,
                pitch: 45
              }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              attributionControl={false}
            >
              {/* User Live Marker */}
              <Marker longitude={liveData.lng} latitude={liveData.lat}>
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-24 h-24 bg-alert/20 rounded-full animate-ping"></div>
                  <div className="absolute w-12 h-12 bg-alert/30 rounded-full animate-pulse"></div>
                  <div className="w-6 h-6 bg-alert rounded-full border-4 border-white shadow-lg z-10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                  </div>
                </div>
              </Marker>
            </Map>
          ) : (
            <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-4">
              <Zap size={32} className="text-gray-400 animate-pulse" />
              <p className="text-lg font-bold text-gray-500">Waiting for GPS satellite lock...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
