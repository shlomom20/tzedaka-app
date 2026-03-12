import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

export default function NavigationMode({ route: initialRoute, initialIndex = 0, onIndexChange, onExit, onBoxUpdated }) {
  const [route, setRoute] = useState(initialRoute);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [showRouteList, setShowRouteList] = useState(false);
  const [jumpOrigin, setJumpOrigin] = useState(null);

  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex]);

  // Clear jump origin when user arrives back at the origin point
  useEffect(() => {
    if (jumpOrigin !== null && currentIndex === jumpOrigin) {
      setJumpOrigin(null);
    }
  }, [currentIndex, jumpOrigin]);

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
      setJumpOrigin(null);
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

  function jumpToIndex(index) {
    if (index < 0 || index >= route.length) return;
    if (jumpOrigin === null) {
      setJumpOrigin(currentIndex);
    }
    setCurrentIndex(index);
    setMapKey((k) => k + 1);
    setShowRouteList(false);
  }

  function handleReturnToOrigin() {
    const origin = jumpOrigin;
    setJumpOrigin(null);
    setCurrentIndex(origin);
    setMapKey((k) => k + 1);
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
      <div className="h-full bg-green-600 flex flex-col items-center justify-center text-white">
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
    <div className="h-full bg-gray-900 flex flex-col overflow-hidden" dir="rtl">
      {/* Top bar */}
      <div className="bg-blue-700 text-white p-3 flex items-center justify-between gap-2 flex-shrink-0">
        <button
          onClick={onExit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          ✕ סיים
        </button>

        {/* Prev / counter / Next */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => jumpToIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-30 rounded-lg transition-colors"
            title="נקודה קודמת"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setShowRouteList(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-center"
            title="כל הנקודות"
          >
            <div className="text-base font-bold leading-none">{progress} / {total}</div>
            <div className="text-xs opacity-75 leading-none mt-0.5">{Math.round(progressPercent)}%</div>
          </button>
          <button
            onClick={() => jumpToIndex(currentIndex + 1)}
            disabled={currentIndex === route.length - 1}
            className="w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:opacity-30 rounded-lg transition-colors"
            title="נקודה הבאה"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="w-16 flex-shrink-0" />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-blue-900 flex-shrink-0">
        <div
          className="h-full bg-green-400 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Map — takes all remaining space */}
      <div className="relative flex-1 min-h-0 w-full">
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
        <div className="absolute bottom-0 inset-x-0 flex gap-2 z-[1000] p-3">
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

      {/* Bottom panel — fixed to content height */}
      <div className="flex-shrink-0 overflow-y-auto bg-white" style={{ maxHeight: '45vh' }}>
        {/* Current box info */}
        <div className="p-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-base leading-tight">{currentBox.name}</h3>
              <p className="text-sm text-gray-600">{currentBox.address || 'ללא כתובת'}</p>
              {currentBox.serial_number && (
                <p className="text-xs text-gray-500 mt-0.5">#{currentBox.serial_number}</p>
              )}
              {currentBox.responsible_phone && (
                <p className="text-xs text-blue-600 mt-0.5">📞 {currentBox.responsible_phone}</p>
              )}
              {currentBox.notes && (
                <p className="text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">
                  📝 {currentBox.notes}
                </p>
              )}
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                currentBox.is_evacuated
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {currentBox.is_evacuated ? '✓ פונה' : '✗ לא פונה'}
            </span>
          </div>
        </div>

        {/* Return to origin button */}
        {jumpOrigin !== null && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-700">
              קפצת מנקודה {jumpOrigin + 1} — {route[jumpOrigin]?.name}
            </span>
            <button
              onClick={handleReturnToOrigin}
              className="flex-shrink-0 text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              ↩ חזור לנקודה {jumpOrigin + 1}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 p-3 border-b">
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors"
          >
            דלג ⏭
          </button>
          <button
            onClick={handleMarkEvacuated}
            disabled={loading || currentBox.is_evacuated}
            className={`py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 ${
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

      {/* Route list drawer — portal so it renders above Leaflet */}
      {showRouteList && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setShowRouteList(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[9999] flex flex-col max-h-[70vh]" dir="rtl">
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
              <h3 className="font-bold text-gray-900">כל הנקודות במסלול</h3>
              <button
                onClick={() => setShowRouteList(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {route.map((box, index) => (
                <button
                  key={box.id}
                  onClick={() => jumpToIndex(index)}
                  className={`w-full text-right px-4 py-3 flex items-center gap-3 border-b border-gray-100 transition-colors ${
                    index === currentIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                    index === currentIndex
                      ? 'bg-blue-600 text-white'
                      : index < currentIndex
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      index === currentIndex ? 'text-blue-700' : index < currentIndex ? 'text-gray-400' : 'text-gray-800'
                    }`}>
                      {box.name}
                    </p>
                    {box.address && (
                      <p className="text-xs text-gray-400 truncate">{box.address}</p>
                    )}
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    box.is_evacuated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {box.is_evacuated ? '✓' : '✗'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
