export default function BoxList({ boxes, onSelectBox, selectedBox, filter }) {
  const filteredBoxes = boxes.filter((box) => {
    if (filter === 'evacuated') return box.is_evacuated;
    if (filter === 'not_evacuated') return !box.is_evacuated;
    return true;
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
      {filteredBoxes.map((box) => (
        <div
          key={box.id}
          onClick={() => onSelectBox(box)}
          className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${
            selectedBox?.id === box.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${
                    box.is_evacuated ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <h3 className="font-semibold text-gray-900 truncate">{box.name}</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  #{box.serial_number}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate">{box.address}</p>
              {box.responsible_phone && (
                <p className="text-xs text-gray-500 mt-1">📞 {box.responsible_phone}</p>
              )}
            </div>
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
          </div>
        </div>
      ))}
    </div>
  );
}
