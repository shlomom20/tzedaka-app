import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  nearestNeighborTSP,
  calculateRouteDistance,
  buildGoogleMapsUrl,
  openWaze,
} from '../lib/routeUtils';

function SortableItem({ box, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: box.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
        title="גרור לסידור מחדש"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>

      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{box.name}</p>
        <p className="text-xs text-gray-500 truncate">{box.address || 'ללא כתובת'}</p>
      </div>

      <span
        className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
          box.is_evacuated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {box.is_evacuated ? 'פונה' : 'לא פונה'}
      </span>

      <button
        onClick={() => onRemove(box.id)}
        className="p-1 text-red-400 hover:text-red-600 transition-colors"
        title="הסר מהמסלול"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function RoutePlanner({ boxes, onStartNavigation }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [route, setRoute] = useState([]);
  const [routeCalculated, setRouteCalculated] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const availableBoxes = boxes.filter(
    (b) => b.latitude && b.longitude && !selectedIds.includes(b.id)
  );

  function handleSelectBox(boxId) {
    const box = boxes.find((b) => b.id === boxId);
    if (!box) return;
    setSelectedIds((prev) => [...prev, boxId]);
    setRoute((prev) => [...prev, box]);
    setRouteCalculated(false);
  }

  function handleRemoveFromRoute(boxId) {
    setSelectedIds((prev) => prev.filter((id) => id !== boxId));
    setRoute((prev) => prev.filter((b) => b.id !== boxId));
    setRouteCalculated(false);
  }

  function handleCalculateRoute() {
    if (route.length < 2) {
      alert('יש לבחור לפחות 2 נקודות למסלול');
      return;
    }
    const optimized = nearestNeighborTSP(route);
    setRoute(optimized);
    setSelectedIds(optimized.map((b) => b.id));
    setRouteCalculated(true);
  }

  function handleSelectAll() {
    const withCoords = boxes.filter((b) => b.latitude && b.longitude);
    setSelectedIds(withCoords.map((b) => b.id));
    setRoute(withCoords);
    setRouteCalculated(false);
  }

  function handleClear() {
    setSelectedIds([]);
    setRoute([]);
    setRouteCalculated(false);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setRoute((items) => {
        const oldIndex = items.findIndex((b) => b.id === active.id);
        const newIndex = items.findIndex((b) => b.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        setSelectedIds(newOrder.map((b) => b.id));
        return newOrder;
      });
      setRouteCalculated(false);
    }
  }

  function handleOpenGoogleMaps() {
    const url = buildGoogleMapsUrl(route);
    if (url) window.open(url, '_blank');
  }

  function handleOpenWaze() {
    if (route.length === 0) return;
    openWaze(route[0].latitude, route[0].longitude);
  }

  const totalDistance = calculateRouteDistance(route);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-white border-b">
        <h2 className="text-lg font-bold text-gray-900 mb-1">תכנון מסלול</h2>
        <p className="text-sm text-gray-500">
          {route.length === 0
            ? 'בחר קופות להוספה למסלול'
            : `${route.length} נקודות במסלול${totalDistance > 0 ? ` • ${totalDistance.toFixed(1)} ק"מ` : ''}`}
        </p>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0">
        {/* Left panel: available boxes */}
        <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-l overflow-y-auto">
          <div className="p-3 bg-gray-50 border-b sticky top-0 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              קופות זמינות ({availableBoxes.length})
            </span>
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              הוסף הכל
            </button>
          </div>
          <div className="p-2 space-y-1">
            {availableBoxes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">
                {boxes.filter((b) => b.latitude && b.longitude).length === 0
                  ? 'אין קופות עם מיקום'
                  : 'כל הקופות נוספו למסלול'}
              </p>
            ) : (
              availableBoxes.map((box) => (
                <button
                  key={box.id}
                  onClick={() => handleSelectBox(box.id)}
                  className="w-full text-right p-2.5 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        box.is_evacuated ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{box.name}</p>
                      <p className="text-xs text-gray-500 truncate">{box.address || 'ללא כתובת'}</p>
                    </div>
                    <svg
                      className="w-4 h-4 text-blue-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel: route */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 bg-gray-50 border-b sticky top-0 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              מסלול ({route.length} נקודות)
            </span>
            {route.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-red-600 hover:text-red-800 font-medium"
              >
                נקה הכל
              </button>
            )}
          </div>

          {route.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-sm">הוסף קופות מהרשימה השמאלית</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={route.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {route.map((box, index) => (
                    <SortableItem
                      key={box.id}
                      box={box}
                      index={index}
                      onRemove={handleRemoveFromRoute}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      {route.length > 0 && (
        <div className="p-4 border-t bg-white space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCalculateRoute}
              className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              🔀 אופטימיזציה
            </button>
            <button
              onClick={() => onStartNavigation(route)}
              disabled={route.length === 0}
              className="py-2.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              🧭 התחל ניווט
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleOpenGoogleMaps}
              className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
            >
              <span>🗺️</span> Google Maps
            </button>
            <button
              onClick={handleOpenWaze}
              className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
            >
              <span>🚗</span> Waze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
