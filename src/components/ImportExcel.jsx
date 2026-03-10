import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createBox } from '../lib/supabase';

// Column mapping: Hebrew header → DB field
const COLUMN_MAP = {
  'מספר סידורי': 'serial_number',
  'שם הקופה': 'name',
  'כתובת': 'address',
  'קו רוחב': 'latitude',
  'קו אורך': 'longitude',
  'טלפון אחראי': 'responsible_phone',
  'הערות': 'notes',
  'פונה': 'is_evacuated',
};

const REQUIRED_FIELDS = ['serial_number', 'name'];

const TEMPLATE_ROWS = [
  ['מספר סידורי', 'שם הקופה', 'כתובת', 'קו רוחב', 'קו אורך', 'טלפון אחראי', 'הערות', 'פונה'],
  ['TZ-001', 'מרכול כהן', 'רחוב הרצל 5, תל אביב', '32.0853', '34.7818', '050-1234567', 'ליד הכניסה', 'לא'],
  ['TZ-002', 'בית כנסת אהבת ציון', 'רחוב בן גוריון 12, ירושלים', '31.7767', '35.2345', '052-9876543', '', 'כן'],
  ['TZ-003', 'מרכז קהילתי', 'שדרות רוטשילד 30, חיפה', '32.8191', '34.9983', '', 'ליד השולחן הכניסה', 'לא'],
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 12 },
    { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 8 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'קופות צדקה');
  XLSX.writeFile(wb, 'תבנית_קופות_צדקה.xlsx');
}

function parseRow(row) {
  const parsed = {};
  for (const [hebrewKey, dbField] of Object.entries(COLUMN_MAP)) {
    const val = row[hebrewKey];
    if (val === undefined || val === null || val === '') {
      parsed[dbField] = null;
      continue;
    }
    if (dbField === 'is_evacuated') {
      parsed[dbField] = String(val).trim() === 'כן' || String(val).trim() === 'true' || val === true;
    } else if (dbField === 'latitude' || dbField === 'longitude') {
      const num = parseFloat(val);
      parsed[dbField] = isNaN(num) ? null : num;
    } else {
      parsed[dbField] = String(val).trim() || null;
    }
  }
  return parsed;
}

function validateRow(row, index, existingBoxes = [], allRows = []) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!row[field]) errors.push(`שדה "${field === 'serial_number' ? 'מספר סידורי' : 'שם הקופה'}" ריק`);
  }

  if (row.serial_number) {
    // Check against DB
    const dbConflict = existingBoxes.find(
      (b) => b.serial_number?.trim().toLowerCase() === row.serial_number.trim().toLowerCase()
    );
    if (dbConflict) errors.push(`מספר סידורי "${row.serial_number}" כבר קיים במערכת`);

    // Check within file (earlier rows)
    const fileConflict = allRows.slice(0, index).find(
      (r) => r.serial_number?.trim().toLowerCase() === row.serial_number.trim().toLowerCase()
    );
    if (fileConflict) errors.push(`מספר סידורי "${row.serial_number}" מופיע יותר מפעם אחת בקובץ`);
  }

  if (row.name) {
    // Check against DB
    const dbConflict = existingBoxes.find(
      (b) => b.name?.trim().toLowerCase() === row.name.trim().toLowerCase()
    );
    if (dbConflict) errors.push(`קופה בשם "${row.name}" כבר קיימת במערכת`);

    // Check within file (earlier rows)
    const fileConflict = allRows.slice(0, index).find(
      (r) => r.name?.trim().toLowerCase() === row.name.trim().toLowerCase()
    );
    if (fileConflict) errors.push(`שם "${row.name}" מופיע יותר מפעם אחת בקובץ`);
  }

  return errors;
}

export default function ImportExcel({ boxes = [], onClose, onImported }) {
  const [rows, setRows] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importErrors, setImportErrors] = useState([]);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data.length === 0) {
          setErrors(['הקובץ ריק או אין נתונים בגיליון הראשון']);
          setRows(null);
          return;
        }

        // Check headers
        const firstRow = data[0];
        const missingHeaders = Object.keys(COLUMN_MAP).filter((h) => !(h in firstRow));
        if (missingHeaders.length > 0) {
          setErrors([`כותרות חסרות בקובץ: ${missingHeaders.join(', ')}`, 'הורד את קובץ התבנית לדוגמה.']);
          setRows(null);
          return;
        }

        const parsed = data.map(parseRow);
        const validationErrors = parsed.flatMap((row, i) =>
          validateRow(row, i, boxes, parsed).map((msg) => `שורה ${i + 2}: ${msg}`)
        );
        setErrors(validationErrors);
        setRows(parsed);
      } catch (err) {
        setErrors(['שגיאה בקריאת הקובץ: ' + err.message]);
        setRows(null);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    setImportErrors([]);
    setProgress({ done: 0, total: rows.length });

    const errs = [];
    let successCount = 0;
    const imported = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const saved = await createBox(rows[i]);
        imported.push(saved);
        successCount++;
      } catch (err) {
        errs.push(`שורה ${i + 2} (${rows[i].serial_number || '?'}): ${err.message}`);
      }
      setProgress({ done: i + 1, total: rows.length });
    }

    setImportErrors(errs);
    setImporting(false);
    setDone(true);
    if (imported.length > 0) onImported(imported, successCount);
  }

  const validRows = rows ? rows.filter((row, i) => validateRow(row, i, boxes, rows).length === 0) : [];
  const hasValidationErrors = errors.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900">ייבוא קופות מ-Excel</h2>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            הורד תבנית
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Done state */}
          {done ? (
            <div className="text-center py-8 space-y-3">
              <div className="text-5xl">✅</div>
              <p className="text-lg font-bold text-gray-900">הייבוא הושלם!</p>
              <p className="text-gray-600">
                יובאו בהצלחה {progress.done - importErrors.length} מתוך {progress.total} קופות
              </p>
              {importErrors.length > 0 && (
                <div className="text-right mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-700 mb-2">שגיאות בייבוא:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {importErrors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                סגור
              </button>
            </div>
          ) : (
            <>
              {/* Upload area */}
              {!rows && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])}
                  />
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-gray-700 font-medium mb-1">גרור קובץ Excel לכאן</p>
                  <p className="text-gray-400 text-sm">או לחץ לבחירת קובץ</p>
                  <p className="text-gray-400 text-xs mt-2">קבצים נתמכים: .xlsx, .xls</p>
                </div>
              )}

              {/* Validation errors */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-700 mb-2">
                    {rows ? `נמצאו ${errors.length} שגיאות (שורות עם שגיאה לא יובאו):` : 'שגיאה בקריאת הקובץ:'}
                  </p>
                  <ul className="text-sm text-red-600 space-y-1 max-h-28 overflow-y-auto">
                    {errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {rows && rows.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-green-700">{validRows.length} שורות תקינות</span>
                      {hasValidationErrors && (
                        <span className="text-red-600 mr-2">• {errors.length} שגיאות</span>
                      )}
                      {' '}מתוך {rows.length} סה"כ
                    </p>
                    <button
                      type="button"
                      onClick={() => { setRows(null); setErrors([]); fileRef.current.value = ''; }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      החלף קובץ
                    </button>
                  </div>

                  <div className="border rounded-lg overflow-auto max-h-56">
                    <table className="w-full text-xs" style={{ direction: 'rtl' }}>
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 border-b">#</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 border-b">מ"ס</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 border-b">שם</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 border-b">כתובת</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 border-b">קואורדינטות</th>
                          <th className="px-2 py-2 text-right font-medium text-gray-600 border-b">סטטוס</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const rowErrors = validateRow(row, i, boxes, rows);
                          const isValid = rowErrors.length === 0;
                          return (
                            <tr
                              key={i}
                              className={`border-b last:border-0 ${isValid ? 'bg-white' : 'bg-red-50'}`}
                            >
                              <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                              <td className="px-2 py-1.5 font-medium text-gray-800">{row.serial_number || <span className="text-red-500">חסר</span>}</td>
                              <td className="px-2 py-1.5 text-gray-700">{row.name || <span className="text-red-500">חסר</span>}</td>
                              <td className="px-2 py-1.5 text-gray-600 max-w-[120px] truncate">{row.address || '—'}</td>
                              <td className="px-2 py-1.5 text-gray-500 font-mono" dir="ltr">
                                {row.latitude && row.longitude
                                  ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
                                  : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                {isValid ? (
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${row.is_evacuated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {row.is_evacuated ? 'פונה' : 'לא פונה'}
                                  </span>
                                ) : (
                                  <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">שגיאה</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Progress bar */}
              {importing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>מייבא...</span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="p-4 border-t flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              onClick={handleImport}
              disabled={!rows || validRows.length === 0 || importing}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {importing ? 'מייבא...' : `ייבא ${validRows.length} קופות`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
