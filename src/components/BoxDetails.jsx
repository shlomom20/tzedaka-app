import { useState } from 'react';
import { markEvacuated, deleteBox } from '../lib/supabase';
import ReportModal from './ReportModal';

export default function BoxDetails({ box, onClose, onEdit, onUpdate, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  async function handleToggleEvacuated() {
    setLoading(true);
    try {
      const updated = await markEvacuated(box.id, !box.is_evacuated);
      onUpdate(updated);
    } catch (err) {
      alert('שגיאה בעדכון: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`האם למחוק את הקופה "${box.name}"?`)) return;
    setLoading(true);
    try {
      await deleteBox(box.id);
      onDelete(box.id);
      onClose();
    } catch (err) {
      alert('שגיאה במחיקה: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('he-IL');
  }

  return (
    <>
      <div className="slide-in-panel bg-white h-full flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            title="סגור"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900 truncate flex-1 text-center px-2">{box.name}</h2>
          <div className="w-9" />
        </div>

        {/* Status Badge */}
        <div className="px-4 pt-4">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              box.is_evacuated
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${box.is_evacuated ? 'bg-green-500' : 'bg-red-500'}`} />
            {box.is_evacuated ? 'פונה' : 'לא פונה'}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <DetailRow label="מספר סידורי" value={box.serial_number} />
          <DetailRow label="כתובת" value={box.address} />
          <DetailRow
            label="מיקום"
            value={
              box.latitude && box.longitude
                ? `${parseFloat(box.latitude).toFixed(5)}, ${parseFloat(box.longitude).toFixed(5)}`
                : '—'
            }
          />
          <DetailRow label="טלפון אחראי" value={box.responsible_phone || '—'} />
          <DetailRow label="הערות" value={box.notes || '—'} multiline />
          <DetailRow label="פונה לאחרונה" value={formatDate(box.last_evacuated_at)} />
          <DetailRow label="נוצר" value={formatDate(box.created_at)} />
          <DetailRow label="עודכן" value={formatDate(box.updated_at)} />
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t space-y-2">
          <button
            onClick={handleToggleEvacuated}
            disabled={loading}
            className={`w-full py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              box.is_evacuated
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {loading ? 'מעדכן...' : box.is_evacuated ? '↩ סמן כלא פונה' : '✓ סמן כפונה'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onEdit(box)}
              className="py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              ✏️ ערוך
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="py-2.5 px-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
            >
              🔧 דווח תקלה
            </button>
          </div>

          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            🗑️ מחק קופה
          </button>
        </div>
      </div>

      {showReport && (
        <ReportModal box={box} onClose={() => setShowReport(false)} />
      )}
    </>
  );
}

function DetailRow({ label, value, multiline }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-medium text-gray-800 ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value}
      </div>
    </div>
  );
}
