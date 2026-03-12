import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createColoredIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

const greenIcon = createColoredIcon('#16a34a');
const redIcon = createColoredIcon('#dc2626');

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

function MapFocuser({ focusLocation }) {
  const map = useMap();
  useEffect(() => {
    if (focusLocation) {
      map.setView([focusLocation.lat, focusLocation.lng], 17);
    }
  }, [focusLocation, map]);
  return null;
}

// Spread markers that share the exact same coordinates in a small circle
function spreadOverlapping(boxes) {
  const OFFSET = 0.00012; // ~13m — small enough to look natural, large enough to click
  const groups = {};
  boxes.forEach((box) => {
    const key = `${box._lat},${box._lng}`;
    (groups[key] = groups[key] || []).push(box);
  });
  return boxes.map((box) => {
    const key = `${box._lat},${box._lng}`;
    const group = groups[key];
    if (group.length === 1) return box;
    const idx = group.indexOf(box);
    const angle = (2 * Math.PI * idx) / group.length;
    return {
      ...box,
      _lat: box._lat + OFFSET * Math.cos(angle),
      _lng: box._lng + OFFSET * Math.sin(angle),
    };
  });
}

export default function Map({ boxes, onSelectBox, selectedBox, filter, focusLocation }) {
  const israelCenter = [31.7683, 35.2137];

  const noLocationCount = boxes.filter(
    (b) => !b.latitude || !b.longitude || isNaN(parseFloat(b.latitude)) || isNaN(parseFloat(b.longitude))
  ).length;

  const filteredBoxes = boxes
    .filter((box) => {
      if (filter === 'evacuated') return box.is_evacuated;
      if (filter === 'not_evacuated') return !box.is_evacuated;
      if (filter === 'no_location') return false;
      if (filter?.startsWith('area:')) return box.area === filter.slice(5);
      return true;
    })
    .map((box) => ({
      ...box,
      _lat: parseFloat(box.latitude),
      _lng: parseFloat(box.longitude),
    }))
    .filter((box) => !isNaN(box._lat) && !isNaN(box._lng));

  const spreadBoxes = spreadOverlapping(filteredBoxes);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {noLocationCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            direction: 'rtl',
          }}
        >
          ⚠️ {noLocationCount} קופות ללא מיקום אינן מוצגות במפה
        </div>
      )}
    <MapContainer
      center={israelCenter}
      zoom={8}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocuser focusLocation={focusLocation} />
      {spreadBoxes.map((box) => {
        return (
          <Marker
            key={box.id}
            position={[box._lat, box._lng]}
            icon={box.is_evacuated ? greenIcon : redIcon}
            eventHandlers={{}}
          >
            <Popup>
              <div style={{ direction: 'rtl', textAlign: 'right', minWidth: '150px' }}>
                <strong>{box.name}</strong>
                <br />
                <span style={{ fontSize: '12px', color: '#666' }}>{box.serial_number}</span>
                <br />
                <span style={{ fontSize: '12px' }}>{box.address}</span>
                <br />
                <span
                  style={{
                    fontSize: '11px',
                    color: box.is_evacuated ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  {box.is_evacuated ? '✓ פונה' : '✗ לא פונה'}
                </span>
                <br />
                <button
                  onClick={() => onSelectBox(box)}
                  style={{
                    marginTop: '6px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  פרטים
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
    </div>
  );
}
