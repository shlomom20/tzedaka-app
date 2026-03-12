import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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

const ROUTE_FILTER_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'not_evacuated', label: 'לא פונה' },
  { value: 'evacuated', label: 'פונה' },
  { value: 'no_location', label: 'ללא מיקום' },
];

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
        style={{ touchAction: 'none' }}
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
  const [routeFilter, setRouteFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef(null);

  // Auto builder state
  const [showAutoBuilder, setShowAutoBuilder] = useState(false);
  const [autoSelectedAreas, setAutoSelectedAreas] = useState([]);
  const [autoTargetCount, setAutoTargetCount] = useState(10);
  const [autoPendingConfirm, setAutoPendingConfirm] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const uniqueAreas = [...new Set(
    boxes.map((b) => b.area).filter((a) => a && a.trim())
  )].sort();

  function applyRouteFilter(boxList) {
    if (routeFilter === 'all') return boxList;
    if (routeFilter === 'evacuated') return boxList.filter((b) => b.is_evacuated);
    if (routeFilter === 'not_evacuated') return boxList.filter((b) => !b.is_evacuated);
    if (routeFilter === 'no_location') return boxList.filter((b) => !b.latitude || !b.longitude);
    if (routeFilter.startsWith('area:')) {
      const area = routeFilter.slice(5);
      return boxList.filter((b) => b.area === area);
    }
    return boxList;
  }

  function getFilterLabel() {
    if (routeFilter.startsWith('area:')) return `אזור: ${routeFilter.slice(5)}`;
    return ROUTE_FILTER_OPTIONS.find((o) => o.value === routeFilter)?.label ?? 'הכל';
  }

  const availableBoxes = applyRouteFilter(boxes).filter(
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
    const toAdd = applyRouteFilter(boxes).filter(
      (b) => b.latitude && b.longitude && !selectedIds.includes(b.id)
    );
    if (toAdd.length === 0) return;
    setSelectedIds((prev) => [...prev, ...toAdd.map((b) => b.id)]);
    setRoute((prev) => [...prev, ...toAdd]);
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

  // Auto builder logic
  function handleBuildAutoRoute() {
    if (autoSelectedAreas.length === 0) {
      alert('יש לבחור לפחות אזור אחד');
      return;
    }
    if (!autoTargetCount || autoTargetCount < 1) {
      alert('יש להזין מספר קופות תקין');
      return;
    }

    const relevantBoxes = boxes.filter(
      (b) => b.latitude && b.longitude && autoSelectedAreas.includes(b.area)
    );

    // Group by area and sort within each area by last_evacuated_at (null first, oldest first)
    const areaGroups = {};
    for (const area of autoSelectedAreas) {
      areaGroups[area] = relevantBoxes
        .filter((b) => b.area === area)
        .sort((a, b) => {
          if (!a.last_evacuated_at && !b.last_evacuated_at) return 0;
          if (!a.last_evacuated_at) return -1;
          if (!b.last_evacuated_at) return 1;
          return new Date(a.last_evacuated_at) - new Date(b.last_evacuated_at);
        });
    }

    // Sort areas by count of unevacuated boxes (descending)
    const sortedAreas = [...autoSelectedAreas].sort((a, b) => {
      const aCount = (areaGroups[a] || []).filter((box) => !box.is_evacuated).length;
      const bCount = (areaGroups[b] || []).filter((box) => !box.is_evacuated).length;
      return bCount - aCount;
    });

    const collected = [];
    for (const area of sortedAreas) {
      const areaBoxes = areaGroups[area] || [];
      for (let i = 0; i < areaBoxes.length; i++) {
        collected.push(areaBoxes[i]);
        if (collected.length === autoTargetCount) {
          const remaining = areaBoxes.slice(i + 1);
          if (remaining.length > 0) {
            setAutoPendingConfirm({ collected: [...collected], remaining, areaName: area });
            return;
          }
          finalizeAutoRoute(collected);
          return;
        }
      }
    }
    finalizeAutoRoute(collected);
  }

  function handleConfirmExtraBoxes(add) {
    const { collected, remaining } = autoPendingConfirm;
    setAutoPendingConfirm(null);
    finalizeAutoRoute(add ? [...collected, ...remaining] : collected);
  }

  function finalizeAutoRoute(boxList) {
    if (boxList.length === 0) {
      alert('לא נמצאו קופות עם מיקום באזורים שנבחרו');
      return;
    }
    const optimized = nearestNeighborTSP(boxList);
    setRoute(optimized);
    setSelectedIds(optimized.map((b) => b.id));
    setRouteCalculated(true);
    setShowAutoBuilder(false);
  }

  function toggleAutoArea(area) {
    setAutoSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  const totalDistance = calculateRouteDistance(route);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 whitespace-nowrap">תכנון מסלול</h2>
          <span className="text-xs text-gray-400 truncate">
            {route.length === 0
              ? 'בחר קופות'
              : `${route.length} נקודות${totalDistance > 0 ? ` • ${totalDistance.toFixed(1)} ק"מ` : ''}`}
          </span>
        </div>
        {uniqueAreas.length > 0 && (
          <button
            onClick={() => {
              setAutoSelectedAreas([]);
              setAutoTargetCount(10);
              setShowAutoBuilder(true);
            }}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            מסלול אוטומטי
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col gap-0">
        {/* Top panel: available boxes */}
        <div className="flex-1 min-h-0 border-b overflow-y-auto">
          <div className="px-2 py-1.5 bg-gray-50 border-b sticky top-0 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-gray-600">
              זמינות ({availableBoxes.length})
            </span>
            <div className="flex items-center gap-2">
              {/* Filter dropdown */}
              <div>
                <button
                  ref={filterBtnRef}
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium border transition-colors ${
                    routeFilter !== 'all'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  🔽 {routeFilter === 'all' ? 'סנן' : getFilterLabel()}
                </button>
                {filterOpen && (() => {
                  const rect = filterBtnRef.current?.getBoundingClientRect();
                  return createPortal(
                    <>
                      <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setFilterOpen(false)}
                      />
                      <div
                        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[160px] overflow-hidden max-h-64 overflow-y-auto"
                        style={rect ? { top: rect.bottom + 4, left: rect.left } : {}}
                        dir="rtl"
                      >
                        {ROUTE_FILTER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => { setRouteFilter(opt.value); setFilterOpen(false); }}
                            className={`w-full text-right px-4 py-2 text-sm transition-colors ${
                              routeFilter === opt.value
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {uniqueAreas.length > 0 && (
                          <>
                            <div className="border-t border-gray-100 px-4 py-1 text-xs text-gray-400 bg-gray-50">
                              סינון לפי אזור
                            </div>
                            {uniqueAreas.map((area) => (
                              <button
                                key={area}
                                onClick={() => { setRouteFilter(`area:${area}`); setFilterOpen(false); }}
                                className={`w-full text-right px-4 py-2 text-sm transition-colors ${
                                  routeFilter === `area:${area}`
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                📍 {area}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </>,
                    document.body
                  );
                })()}
              </div>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                הוסף הכל
              </button>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {availableBoxes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">
                {boxes.filter((b) => b.latitude && b.longitude).length === 0
                  ? 'אין קופות עם מיקום'
                  : routeFilter !== 'all'
                  ? 'אין קופות התואמות את הסינון'
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
                      <p className="text-xs text-gray-500 truncate">
                        {box.area ? `${box.area} • ` : ''}{box.address || 'ללא כתובת'}
                      </p>
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

        {/* Bottom panel: route */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-2 py-1.5 bg-gray-50 border-b sticky top-0 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              מסלול ({route.length} נקודות)
            </span>
            {route.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                נקה
              </button>
            )}
          </div>

          {route.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="text-sm">הוסף קופות מהרשימה למעלה</p>
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
        <div className="px-3 py-2 border-t bg-white">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleCalculateRoute}
              className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              🔀 אופטימיזציה
            </button>
            <button
              onClick={() => onStartNavigation(route)}
              disabled={route.length === 0}
              className="py-1.5 px-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              🧭 התחל ניווט
            </button>
          </div>
        </div>
      )}

      {/* Auto Builder Modal */}
      {showAutoBuilder && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setShowAutoBuilder(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" dir="rtl">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col">
              {/* Modal header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-bold text-gray-900">בנה מסלול אוטומטי</h3>
                <button
                  onClick={() => setShowAutoBuilder(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Area selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    בחר אזורים
                    {autoSelectedAreas.length > 0 && (
                      <span className="mr-2 text-blue-600 font-normal">
                        ({autoSelectedAreas.length} נבחרו)
                      </span>
                    )}
                  </label>
                  <div className="space-y-1 border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                    {uniqueAreas.map((area) => {
                      const areaBoxes = boxes.filter((b) => b.area === area && b.latitude && b.longitude);
                      const unevacuated = areaBoxes.filter((b) => !b.is_evacuated).length;
                      return (
                        <label
                          key={area}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={autoSelectedAreas.includes(area)}
                            onChange={() => toggleAutoArea(area)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="flex-1 text-sm text-gray-800">{area}</span>
                          <span className="text-xs text-gray-400">
                            {unevacuated} לא פונו / {areaBoxes.length} סה"כ
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setAutoSelectedAreas([...uniqueAreas])}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      בחר הכל
                    </button>
                    <span className="text-xs text-gray-300">|</span>
                    <button
                      onClick={() => setAutoSelectedAreas([])}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      נקה בחירה
                    </button>
                  </div>
                </div>

                {/* Target count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    מספר קופות רצוי במסלול
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={autoTargetCount}
                    onChange={(e) => setAutoTargetCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {/* Algorithm explanation */}
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                  <p className="font-medium">כיצד האלגוריתם עובד:</p>
                  <p>• ממיין אזורים לפי כמות הקופות שלא פונו (מהגדולה לקטנה)</p>
                  <p>• בכל אזור — מוסיף קופות לפי ותק (הישנות ביותר קודם)</p>
                  <p>• בסיום — מייעל את סדר המסלול אוטומטית</p>
                </div>
              </div>

              <div className="p-4 border-t flex gap-2">
                <button
                  onClick={() => setShowAutoBuilder(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={handleBuildAutoRoute}
                  disabled={autoSelectedAreas.length === 0}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  בנה מסלול
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Mid-area confirmation dialog */}
      {autoPendingConfirm && createPortal(
        <>
          <div className="fixed inset-0 bg-black/50 z-[9998]" />
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" dir="rtl">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
              <div className="text-3xl mb-3">📍</div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                הגעת ל-{autoPendingConfirm.collected.length} קופות
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                יש עוד{' '}
                <span className="font-bold text-purple-700">
                  {autoPendingConfirm.remaining.length}
                </span>{' '}
                קופות באזור{' '}
                <span className="font-bold">"{autoPendingConfirm.areaName}"</span>,
                להוסיף למסלול?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAutoPendingConfirm(null)}
                  className="flex-1 py-2 bg-white hover:bg-gray-50 text-gray-500 rounded-lg text-sm font-medium transition-colors border border-gray-200"
                >
                  ביטול תהליך
                </button>
                <button
                  onClick={() => handleConfirmExtraBoxes(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  לא, מספיק
                </button>
                <button
                  onClick={() => handleConfirmExtraBoxes(true)}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  כן, הוסף הכל
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
