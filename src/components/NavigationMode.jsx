import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { markEvacuated } from '../lib/supabase';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createNavIcon(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="32" height="48">
    <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 32 16 32s16-20 16-32C32 7.164 24.836 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="16" y="21" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial">${label}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -48],
  });
}

function MapCenterUpdater({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 16);
  }, [lat, lng, map]);
  return null;
}

export default function NavigationMode({ route: initialRoute, onExit, onBoxUpdated }) {
  const [route, setRoute] = useState(initialRoute);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const currentBox = route[currentIndex];
  const progress = currentIndex + 1;
  const total = route.length;
  const progressPercent = (currentIndex / total) * 100;

  async function handleMarkEvacuated() {
    if (!currentBox) return;
    setLoading(true);
    try {
      const updated = await markEvacuated(currentBox.id, true);
      onBoxUpdated(updated);
      setRoute((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
      moveToNext();
    } catch (err) {
      alert('שגיאה בעדכון: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    moveToNext();
  }

  function moveToNext() {
    if (currentIndex + 1 >= route.length) {
      if (confirm('סיימת את כל הנקודות! לצאת ממצב ניווט?')) {
        onExit();
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setMapKey((k) => k + 1);
    }
  }

  function openWazeForCurrent() {
    if (!currentBox?.latitude || !currentBox?.longitude) return;
    window.open(
      `https://waze.com/ul?ll=${currentBox.latitude},${currentBox.longitude}&navigate=yes`,
      '_blank'
    );
  }

  function openGoogleMapsForCurrent() {
    if (!currentBox?.latitude || !currentBox?.longitude) return;
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${currentBox.latitude},${currentBox.longitude}`,
      '_blank'
    );
  }

  if (!currentBox) {
    return (
      <div className="fixed inset-0 bg-green-600 z-50 flex flex-col items-center justify-center text-white">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold mb-2">כל הכבוד!</h2>
        <p className="text-xl mb-8">סיימת את כל הנקודות במסלול</p>
        <button
          onClick={onExit}
          className="px-8 py-3 bg-white text-green-700 rounded-xl font-bold text-lg hover:bg-green-50 transition-colors"
        >
          סיים ניווט
        </button>
      </div>
    );
  }

  const lat = parseFloat(currentBox.latitude);
  const lng = parseFloat(currentBox.longitude);
  const hasCoords = !isNaN(lat) && !isNaN(lng);

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-blue-700 text-white p-3 flex items-center justify-between">
        <button
          onClick={onExit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          ✕ סיים ניווט
        </button>
        <div className="text-center">
          <div className="text-lg font-bold">
            {progress} / {total} נקודות
          </div>
        </div>
        <div className="text-sm opacity-75">
          {Math.round(progressPercent)}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-blue-900">
        <div
          className="h-full bg-green-400 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {hasCoords ? (
          <MapContainer
            key={mapKey}
            center={[lat, lng]}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenterUpdater lat={lat} lng={lng} />
            <Marker
              position={[lat, lng]}
              icon={createNavIcon(currentBox.is_evacuated ? '#16a34a' : '#dc2626', `${progress}`)}
            >
              <Popup>
                <div style={{ direction: 'rtl', textAlign: 'right' }}>
                  <strong>{currentBox.name}</strong>
                  <br />
                  <span style={{ fontSize: '12px' }}>{currentBox.address}</span>
                </div>
              </Popup>
            </Marker>
            {route.slice(currentIndex + 1).map((box, i) => {
              const bLat = parseFloat(box.latitude);
              const bLng = parseFloat(box.longitude);
              if (isNaN(bLat) || isNaN(bLng)) return null;
              return (
                <Marker
                  key={box.id}
                  position={[bLat, bLng]}
                  icon={createNavIcon('#9ca3af', `${currentIndex + i + 2}`)}
                  opacity={0.5}
                />
              );
            })}
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-800 text-white">
            <div className="text-center">
              <div className="text-4xl mb-3">📍</div>
              <p>אין מיקום GPS לנקודה זו</p>
            </div>
          </div>
        )}

        {/* Floating navigation buttons */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 z-[1000]">
          <button
            onClick={openWazeForCurrent}
            className="flex-1 py-2 bg-white/90 backdrop-blur-sm text-gray-800 rounded-xl text-sm font-medium shadow-lg hover:bg-white transition-colors"
          >
            🚗 Waze
          </button>
          <button
            onClick={openGoogleMapsForCurrent}
            className="flex-1 py-2 bg-white/90 backdrop-blur-sm text-gray-800 rounded-xl text-sm font-medium shadow-lg hover:bg-white transition-colors"
          >
            🗺️ Google
          </button>
        </div>
      </div>

      {/* Bottom panel */}
      <div className="bg-white p-4 space-y-3">
        {/* Current box info */}
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-lg">{currentBox.name}</h3>
              <p className="text-sm text-gray-600">{currentBox.address || 'ללא כתובת'}</p>
              {currentBox.serial_number && (
                <p className="text-xs text-gray-500 mt-1">#{currentBox.serial_number}</p>
              )}
              {currentBox.responsible_phone && (
                <p className="text-xs text-blue-600 mt-1">📞 {currentBox.responsible_phone}</p>
              )}
              {currentBox.notes && (
                <p className="text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">
                  📝 {currentBox.notes}
                </p>
              )}
            </div>
            <span
              className={`text-sm px-2 py-1 rounded-full font-medium flex-shrink-0 mr-2 ${
                currentBox.is_evacuated
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {currentBox.is_evacuated ? '✓ פונה' : '✗ לא פונה'}
            </span>
          </div>
        </div>

        {/* Upcoming */}
        {currentIndex + 1 < route.length && (
          <p className="text-xs text-gray-500 text-center">
            הבא: <span className="font-medium">{route[currentIndex + 1].name}</span>
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
          >
            דלג ⏭
          </button>
          <button
            onClick={handleMarkEvacuated}
            disabled={loading || currentBox.is_evacuated}
            className={`py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${
              currentBox.is_evacuated
                ? 'bg-green-200 text-green-700 flex-1'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
            style={{ flexGrow: currentBox.is_evacuated ? 1 : 2 }}
          >
            {loading ? 'מעדכן...' : currentBox.is_evacuated ? '✓ כבר פונה' : 'סומן כפונה ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
