import { useState, useEffect, useCallback } from 'react';
import { fetchBoxes } from './lib/supabase';
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

const FILTER_OPTIONS = [
  { value: 'all', label: 'הכל' },
  { value: 'not_evacuated', label: 'לא פונו' },
  { value: 'evacuated', label: 'פונו' },
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
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <nav className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
              <div className="flex items-center gap-1">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                      filter === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
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
          <div className="flex-1 flex gap-4 min-h-0" style={{ height: 'calc(100vh - 160px)' }}>
            {/* Main panel */}
            <div
              className={`flex-1 min-w-0 ${
                activeTab === 'route' ? 'bg-white rounded-xl shadow overflow-hidden' : ''
              }`}
            >
              {activeTab === 'map' && (
                <div className="h-full bg-white rounded-xl shadow overflow-hidden">
                  <Map
                    boxes={boxes}
                    onSelectBox={handleSelectBox}
                    selectedBox={selectedBox}
                    filter={filter}
                  />
                </div>
              )}

              {activeTab === 'list' && (
                <div className="h-full bg-white rounded-xl shadow overflow-y-auto">
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
                    />
                  )}
                </div>
              )}

              {activeTab === 'route' && (
                <RoutePlanner boxes={boxes} onStartNavigation={handleStartNavigation} />
              )}
            </div>

            {/* Details panel */}
            {selectedBox && activeTab !== 'route' && (
              <div className="w-80 flex-shrink-0 bg-white rounded-xl shadow overflow-hidden">
                <BoxDetails
                  box={selectedBox}
                  onClose={handleCloseDetails}
                  onEdit={handleEdit}
                  onUpdate={handleUpdated}
                  onDelete={handleDeleted}
                />
              </div>
            )}
          </div>
        )}
      </main>

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
