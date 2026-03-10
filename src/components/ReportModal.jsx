import { useState } from 'react';

export default function ReportModal({ box, onClose }) {
  const [reporterName, setReporterName] = useState('');
  const [reportText, setReportText] = useState('');

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@example.com';

  function handleSend() {
    if (!reporterName.trim()) {
      alert('יש להזין שם מדווח');
      return;
    }
    if (!reportText.trim()) {
      alert('יש להזין תיאור התקלה');
      return;
    }

    const subject = encodeURIComponent(`דיווח תקלה - קופה ${box.serial_number} - ${box.name}`);
    const body = encodeURIComponent(
      `דיווח תקלה עבור קופה:\n` +
        `מספר סידורי: ${box.serial_number}\n` +
        `שם: ${box.name}\n` +
        `כתובת: ${box.address || '—'}\n\n` +
        `מדווח: ${reporterName}\n\n` +
        `תיאור התקלה:\n${reportText}\n\n` +
        `תאריך: ${new Date().toLocaleString('he-IL')}`
    );

    window.open(`mailto:${adminEmail}?subject=${subject}&body=${body}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 modal-overlay" style={{ zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900">דיווח תקלה</h2>
          <div className="w-9" />
        </div>

        <div className="p-4 space-y-4">
          {/* Box info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm font-medium text-yellow-800">
              קופה: {box.name}
            </p>
            <p className="text-xs text-yellow-700">{box.serial_number} • {box.address || 'ללא כתובת'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שמך <span className="text-red-500">*</span>
            </label>
            <input
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="הכנס שם מדווח"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תיאור התקלה <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={4}
              placeholder="תאר את התקלה בפירוט..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <p className="text-xs text-gray-500">
            הדיווח יישלח לכתובת: <span className="font-mono">{adminEmail}</span>
          </p>
        </div>

        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSend}
            className="flex-1 py-2.5 px-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
          >
            📧 שלח דיווח
          </button>
        </div>
      </div>
    </div>
  );
}
