export default function BoxList({
  boxes, onSelectBox, selectedBox, filter,
  selectMode, selectedIds, onToggleSelect, searchQuery = '',
}) {
  const filteredBoxes = boxes.filter((box) => {
    const hasLocation = box.latitude && box.longitude &&
      !isNaN(parseFloat(box.latitude)) && !isNaN(parseFloat(box.longitude));
    if (filter === 'evacuated') return box.is_evacuated;
    if (filter === 'not_evacuated') return !box.is_evacuated;
    if (filter === 'no_location') return !hasLocation;
    if (filter?.startsWith('area:')) return box.area === filter.slice(5);
    return true;
  }).filter((box) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return box.name?.toLowerCase().includes(q) || box.address?.toLowerCase().includes(q);
  });

  if (filteredBoxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="text-5xl mb-4">📦</div>
        <p className="text-lg">אין קופות להצגה</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {filteredBoxes.map((box) => {
        const hasLocation = box.latitude && box.longitude &&
          !isNaN(parseFloat(box.latitude)) && !isNaN(parseFloat(box.longitude));
        const isSelected = selectedBox?.id === box.id;
        const isChecked = selectedIds?.has(box.id);

        return (
          <div
            key={box.id}
            onClick={() => selectMode ? onToggleSelect(box.id) : onSelectBox(box)}
            className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${
              !selectMode && isSelected ? 'bg-blue-50 border-r-4 border-blue-500' : ''
            } ${selectMode && isChecked ? 'bg-red-50' : ''} ${
              !hasLocation ? 'border-2 border-red-400 rounded-lg m-1' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Checkbox in select mode */}
              {selectMode && (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleSelect(box.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 flex-shrink-0 cursor-pointer"
                />
              )}

              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${
                        box.is_evacuated ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <h3 className="font-semibold text-gray-900 truncate">{box.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      #{box.serial_number}
                    </span>
                    {!hasLocation && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-300 px-2 py-0.5 rounded-full flex-shrink-0">
                        ללא מיקום
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{box.address || '—'}</p>
                  {box.responsible_phone && (
                    <p className="text-xs text-gray-500 mt-1">📞 {box.responsible_phone}</p>
                  )}
                </div>
                {!selectMode && (
                  <div className="flex flex-col items-end mr-3 flex-shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        box.is_evacuated
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {box.is_evacuated ? 'פונה' : 'לא פונה'}
                    </span>
                    {box.last_evacuated_at && (
                      <span className="text-xs text-gray-400 mt-1">
                        {new Date(box.last_evacuated_at).toLocaleDateString('he-IL')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
