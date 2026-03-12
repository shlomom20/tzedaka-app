import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchBoxes, deleteBoxes } from './lib/supabase';
import Map from './components/Map';
import BoxList from './components/BoxList';
import BoxDetails from './components/BoxDetails';
import AddEditBox from './components/AddEditBox';
import RoutePlanner from './components/RoutePlanner';
import NavigationMode from './components/NavigationMode';
import ImportExcel from './components/ImportExcel';

const TABS = [
  { id: 'map', label: '🗺️ מפה' },
  { id: 'list', label: '📋 רשימה' },
  { id: 'route', label: '🧭 מסלול' },
];

const STATIC_FILTER_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'not_evacuated', label: 'לא פונו' },
  { value: 'evacuated', label: 'פונו' },
  { value: 'no_location', label: 'ללא מיקום' },
];

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('map');
  const [filter, setFilter] = useState('all');
  const [selectedBox, setSelectedBox] = useState(null);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [navigationRoute, setNavigationRoute] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Back button closes details panel instead of navigating away
  const detailsOpenRef = useRef(false);
  useEffect(() => {
    if (selectedBox && !detailsOpenRef.current) {
      detailsOpenRef.current = true;
      history.pushState({ detailsOpen: true }, '');
    } else if (!selectedBox) {
      detailsOpenRef.current = false;
    }
  }, [selectedBox]);

  useEffect(() => {
    function handlePopState() {
      if (detailsOpenRef.current) {
        detailsOpenRef.current = false;
        setSelectedBox(null);
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadBoxes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBoxes();
      setBoxes(data || []);
    } catch (err) {
      setError('שגיאה בטעינת נתונים: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoxes();
  }, [loadBoxes]);

  function handleSelectBox(box) {
    setSelectedBox(box);
  }

  function handleCloseDetails() {
    setSelectedBox(null);
  }

  function handleToggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
    setSelectedBox(null);
  }

  function handleToggleSelectId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`האם למחוק ${selectedIds.size} קופות? פעולה זו אינה הפיכה.`)) return;
    setBulkDeleting(true);
    try {
      await deleteBoxes([...selectedIds]);
      setBoxes((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      alert('שגיאה במחיקה: ' + err.message);
    } finally {
      setBulkDeleting(false);
    }
  }

  function handleShowOnMap(box) {
    setMapFocus({ lat: parseFloat(box.latitude), lng: parseFloat(box.longitude) });
    setActiveTab('map');
    setSelectedBox(null);
  }

  function handleEdit(box) {
    setEditingBox(box);
    setShowAddEdit(true);
    setSelectedBox(null);
  }

  function handleAddNew() {
    setEditingBox(null);
    setShowAddEdit(true);
  }

  function handleSaved(savedBox) {
    setBoxes((prev) => {
      const exists = prev.find((b) => b.id === savedBox.id);
      if (exists) {
        return prev.map((b) => (b.id === savedBox.id ? savedBox : b));
      }
      return [savedBox, ...prev];
    });
    setShowAddEdit(false);
    setEditingBox(null);
  }

  function handleUpdated(updatedBox) {
    setBoxes((prev) => prev.map((b) => (b.id === updatedBox.id ? updatedBox : b)));
    setSelectedBox(updatedBox);
  }

  function handleDeleted(boxId) {
    setBoxes((prev) => prev.filter((b) => b.id !== boxId));
    setSelectedBox(null);
  }

  function handleStartNavigation(route) {
    setNavigationRoute(route);
  }

  function handleExitNavigation() {
    setNavigationRoute(null);
  }

  function handleNavBoxUpdated(updatedBox) {
    setBoxes((prev) => prev.map((b) => (b.id === updatedBox.id ? updatedBox : b)));
  }

  const evacuatedCount = boxes.filter((b) => b.is_evacuated).length;
  const notEvacuatedCount = boxes.filter((b) => !b.is_evacuated).length;

  const uniqueAreas = [...new Set(
    boxes.map((b) => b.area).filter((a) => a && a.trim())
  )].sort();

  function getFilterLabel() {
    if (filter.startsWith('area:')) {
      const area = filter.slice(5);
      return `אזור: ${area}`;
    }
    return STATIC_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'הכל';
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏛️</span>
              <div>
                <h1 className="text-xl font-bold leading-tight">ניהול קופות צדקה</h1>
                <p className="text-blue-200 text-xs">
                  {boxes.length} קופות •{' '}
                  <span className="text-green-300">{evacuatedCount} פונו</span> •{' '}
                  <span className="text-red-300">{notEvacuatedCount} לא פונו</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-400 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="hidden sm:inline">ייבא Excel</span>
              </button>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">הוסף קופה</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs + Filter */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-[1100]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <nav className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'map') setSelectedBox(null);
                    setActiveTab(tab.id);
                  }}
                  className={`px-2 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Filter (only for map/list) */}
            {activeTab !== 'route' && (
              <div className="relative">
                <button
                  onClick={() => setFilterOpen((v) => !v)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full font-medium transition-colors border ${
                    filter !== 'all'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  🔽 סנן לפי{filter !== 'all' && `: ${getFilterLabel()}`}
                </button>
                {filterOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[1101]"
                      onClick={() => setFilterOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1102] min-w-[140px] overflow-hidden max-h-72 overflow-y-auto">
                      {STATIC_FILTER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setFilter(opt.value); setFilterOpen(false); }}
                          className={`w-full text-right px-4 py-2 text-sm transition-colors ${
                            filter === opt.value
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
                              onClick={() => { setFilter(`area:${area}`); setFilterOpen(false); }}
                              className={`w-full text-right px-4 py-2 text-sm transition-colors ${
                                filter === `area:${area}`
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-3">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadBoxes} className="text-sm underline hover:no-underline">
              נסה שוב
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">טוען קופות...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Map tab */}
            {activeTab === 'map' && (
              <div
                className="bg-white rounded-xl shadow overflow-hidden"
                style={{ height: 'calc(100vh - 160px)' }}
              >
                <Map
                  boxes={boxes}
                  onSelectBox={handleSelectBox}
                  selectedBox={selectedBox}
                  filter={filter}
                  focusLocation={mapFocus}
                />
              </div>
            )}

            {/* List tab — scrollable list + fixed-height details panel side by side */}
            {activeTab === 'list' && (
              <div
                className="flex gap-4 overflow-hidden"
                style={{ height: 'calc(100vh - 160px)' }}
              >
                {/* List — scrolls internally */}
                <div className="flex-1 min-w-0 overflow-y-auto bg-white rounded-xl shadow flex flex-col">
                  {/* Toolbar */}
                  <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      {selectMode ? (
                        <>
                          <span className="text-sm text-gray-600">
                            {selectedIds.size > 0
                              ? `נבחרו ${selectedIds.size} קופות`
                              : 'בחר קופות למחיקה'}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={handleBulkDelete}
                              disabled={selectedIds.size === 0 || bulkDeleting}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-40"
                            >
                              {bulkDeleting ? 'מוחק...' : `🗑️ מחק (${selectedIds.size})`}
                            </button>
                            <button
                              onClick={handleToggleSelectMode}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium transition-colors"
                            >
                              ביטול
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-gray-500">{boxes.length} קופות</span>
                          <button
                            onClick={handleToggleSelectMode}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg font-medium transition-colors"
                          >
                            ☑️ בחירה מרובה
                          </button>
                        </>
                      )}
                    </div>
                    {!selectMode && (
                      <input
                        type="text"
                        placeholder="חפש לפי שם/כתובת קופה..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        dir="rtl"
                      />
                    )}
                  </div>

                  {boxes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <div className="text-5xl mb-4">📦</div>
                      <p className="text-lg mb-2">אין קופות במערכת</p>
                      <button
                        onClick={handleAddNew}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                      >
                        הוסף קופה ראשונה
                      </button>
                    </div>
                  ) : (
                    <BoxList
                      boxes={boxes}
                      onSelectBox={handleSelectBox}
                      selectedBox={selectedBox}
                      filter={filter}
                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      onToggleSelect={handleToggleSelectId}
                      searchQuery={searchQuery}
                    />
                  )}
                </div>

                {/* Details — fixed to container height, own scroll, stays while list scrolls */}
                {selectedBox && (
                  <div
                    className="w-80 flex-shrink-0 bg-white rounded-xl shadow flex flex-col overflow-hidden"
                    style={{ height: '100%' }}
                  >
                    <BoxDetails
                      box={selectedBox}
                      onClose={handleCloseDetails}
                      onEdit={handleEdit}
                      onUpdate={handleUpdated}
                      onDelete={handleDeleted}
                      onShowOnMap={handleShowOnMap}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Route tab */}
            {activeTab === 'route' && (
              <div
                className="bg-white rounded-xl shadow overflow-hidden"
                style={{ height: 'calc(100vh - 160px)' }}
              >
                <RoutePlanner boxes={boxes} onStartNavigation={handleStartNavigation} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Map tab details — fixed overlay (only on map tab) */}
      {selectedBox && activeTab === 'map' && (
        <>
          <div
            className="fixed inset-0 bg-black/30"
            style={{ zIndex: 1100 }}
            onClick={handleCloseDetails}
          />
          <div className="fixed top-0 left-0 h-full w-96 shadow-2xl" style={{ zIndex: 1101 }}>
            <BoxDetails
              box={selectedBox}
              onClose={handleCloseDetails}
              onEdit={handleEdit}
              onUpdate={handleUpdated}
              onDelete={handleDeleted}
              onShowOnMap={handleShowOnMap}
            />
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showAddEdit && (
        <AddEditBox
          box={editingBox}
          boxes={boxes}
          onClose={() => {
            setShowAddEdit(false);
            setEditingBox(null);
          }}
          onSave={handleSaved}
        />
      )}

      {/* Import Excel Modal */}
      {showImport && (
        <ImportExcel
          boxes={boxes}
          onClose={() => setShowImport(false)}
          onImported={(imported) => {
            setBoxes((prev) => [...imported, ...prev]);
            setShowImport(false);
          }}
        />
      )}

      {/* Navigation Mode */}
      {navigationRoute && (
        <NavigationMode
          route={navigationRoute}
          onExit={handleExitNavigation}
          onBoxUpdated={handleNavBoxUpdated}
        />
      )}
    </div>
  );
}
