import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { createBox, updateBox } from '../lib/supabase';

const emptyForm = {
  serial_number: '',
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  responsible_phone: '',
  notes: '',
  is_evacuated: false,
};

const pinIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="30" height="44">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="#2563eb" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`,
  className: '',
  iconSize: [30, 44],
  iconAnchor: [15, 44],
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

const LOCATION_TABS = [
  { id: 'address', label: '🔍 חיפוש כתובת' },
  { id: 'coords', label: '📐 קואורדינטות' },
  { id: 'map', label: '🗺️ בחר במפה' },
];

export default function AddEditBox({ box, boxes = [], onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [locationTab, setLocationTab] = useState('address');

  const isEdit = !!box;
  const hasCoords =
    form.latitude !== '' && form.longitude !== '' &&
    !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude));

  useEffect(() => {
    if (box) {
      setForm({
        serial_number: box.serial_number || '',
        name: box.name || '',
        address: box.address || '',
        latitude: box.latitude != null ? String(box.latitude) : '',
        longitude: box.longitude != null ? String(box.longitude) : '',
        responsible_phone: box.responsible_phone || '',
        notes: box.notes || '',
        is_evacuated: box.is_evacuated || false,
      });
    }
  }, [box]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleGeocode() {
    if (!form.address.trim()) {
      setError('יש להזין כתובת לפני ביצוע חיפוש');
      return;
    }
    setGeocoding(true);
    setError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1&accept-language=he`,
        { headers: { 'Accept-Language': 'he' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setForm((prev) => ({ ...prev, latitude: data[0].lat, longitude: data[0].lon }));
      } else {
        setError('לא נמצאה כתובת. נסה כתובת מדויקת יותר, או השתמש בקואורדינטות / בחירה במפה.');
      }
    } catch (err) {
      setError('שגיאה בחיפוש הכתובת: ' + err.message);
    } finally {
      setGeocoding(false);
    }
  }

  function handleMapClick({ lat, lng }) {
    setForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.serial_number.trim()) { setError('מספר סידורי הוא שדה חובה'); return; }
    if (!form.name.trim()) { setError('שם הקופה הוא שדה חובה'); return; }

    // Duplicate validation (exclude current box when editing)
    const others = boxes.filter((b) => b.id !== box?.id);
    const serialExists = others.some(
      (b) => b.serial_number?.trim().toLowerCase() === form.serial_number.trim().toLowerCase()
    );
    if (serialExists) {
      setError(`מספר סידורי "${form.serial_number.trim()}" כבר קיים במערכת. יש לבחור מספר ייחודי.`);
      return;
    }
    const nameExists = others.some(
      (b) => b.name?.trim().toLowerCase() === form.name.trim().toLowerCase()
    );
    if (nameExists) {
      setError(`קופה בשם "${form.name.trim()}" כבר קיימת במערכת. יש לבחור שם ייחודי.`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        serial_number: form.serial_number.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
        latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
        longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
        responsible_phone: form.responsible_phone.trim() || null,
        notes: form.notes.trim() || null,
        is_evacuated: form.is_evacuated,
      };
      const saved = isEdit ? await updateBox(box.id, payload) : await createBox(payload);
      onSave(saved);
    } catch (err) {
      setError('שגיאה בשמירה: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const mapCenter = hasCoords
    ? [parseFloat(form.latitude), parseFloat(form.longitude)]
    : [31.7683, 35.2137];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'עריכת קופה' : 'הוספת קופה חדשה'}
          </h2>
          <div className="w-9" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Serial + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מספר סידורי <span className="text-red-500">*</span>
              </label>
              <input
                name="serial_number"
                value={form.serial_number}
                onChange={handleChange}
                placeholder="לדוגמה: TZ-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם הקופה <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="שם מיקום הקופה"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Location section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Location tabs */}
            <div className="flex border-b bg-gray-50">
              {LOCATION_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLocationTab(tab.id)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    locationTab === tab.id
                      ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-3">
              {/* Tab 1: Address search */}
              {locationTab === 'address' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">כתובת</label>
                  <div className="flex gap-2">
                    <input
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="רחוב, מספר, עיר"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleGeocode}
                      disabled={geocoding}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {geocoding ? '...' : '🔍 חפש'}
                    </button>
                  </div>
                  {hasCoords && (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ מיקום נמצא: {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">לא מצאת? עבור לטאב "קואורדינטות" או "בחר במפה"</p>
                </div>
              )}

              {/* Tab 2: Manual coordinates */}
              {locationTab === 'coords' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">הזן קואורדינטות GPS ידנית (ניתן להעתיק מגוגל מפות)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">קו רוחב (Lat)</label>
                      <input
                        name="latitude"
                        value={form.latitude}
                        onChange={handleChange}
                        type="number"
                        step="any"
                        placeholder="31.7683"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">קו אורך (Lng)</label>
                      <input
                        name="longitude"
                        value={form.longitude}
                        onChange={handleChange}
                        type="number"
                        step="any"
                        placeholder="35.2137"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  {hasCoords && (
                    <p className="text-xs text-green-600 font-medium">✓ קואורדינטות תקינות</p>
                  )}
                  <p className="text-xs text-gray-400">
                    טיפ: בגוגל מפות לחץ לחיצה ימנית על נקודה ← ההגדרות יופיעו למעלה
                  </p>
                </div>
              )}

              {/* Tab 3: Map click */}
              {locationTab === 'map' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">לחץ על המפה כדי לסמן את מיקום הקופה</p>
                  <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '220px' }}>
                    <MapContainer
                      center={mapCenter}
                      zoom={hasCoords ? 15 : 8}
                      style={{ height: '100%', width: '100%' }}
                      key={locationTab}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <MapClickHandler onMapClick={handleMapClick} />
                      {hasCoords && (
                        <Marker
                          position={[parseFloat(form.latitude), parseFloat(form.longitude)]}
                          icon={pinIcon}
                          draggable
                          eventHandlers={{
                            dragend: (e) => {
                              const { lat, lng } = e.target.getLatLng();
                              setForm((prev) => ({
                                ...prev,
                                latitude: lat.toFixed(6),
                                longitude: lng.toFixed(6),
                              }));
                            },
                          }}
                        />
                      )}
                    </MapContainer>
                  </div>
                  {hasCoords ? (
                    <p className="text-xs text-green-600 font-medium">
                      ✓ {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)} — ניתן לגרור את הסמן לכיוון
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">טרם נבחר מיקום — לחץ על המפה</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Address field (always visible, not part of location tabs) */}
          {locationTab !== 'address' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">כתובת (לתצוגה)</label>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="כתובת לתצוגה (אופציונלי)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">טלפון אחראי</label>
            <input
              name="responsible_phone"
              value={form.responsible_phone}
              onChange={handleChange}
              type="tel"
              placeholder="050-0000000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              dir="ltr"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="הערות נוספות..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Evacuated checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_evacuated"
              id="is_evacuated"
              checked={form.is_evacuated}
              onChange={handleChange}
              className="w-4 h-4 text-green-600 rounded"
            />
            <label htmlFor="is_evacuated" className="text-sm font-medium text-gray-700">
              הקופה פונתה
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'שומר...' : isEdit ? 'שמור שינויים' : 'הוסף קופה'}
          </button>
        </div>
      </div>
    </div>
  );
}
