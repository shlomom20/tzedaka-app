# הגדרת מערכת ניהול קופות צדקה

## דרישות מוקדמות

- Node.js 18+
- חשבון Supabase (חינמי בכתובת https://supabase.com)

---

## שלב 1: יצירת פרויקט Supabase

1. היכנס ל-https://supabase.com ופתח פרויקט חדש
2. לאחר יצירת הפרויקט, עבור ל: **Settings → API**
3. העתק את:
   - **Project URL** (נראה כך: `https://xxxxxxxx.supabase.co`)
   - **anon public** key

---

## שלב 2: יצירת טבלת הנתונים

עבור ל-**SQL Editor** בדשבורד של Supabase והרץ את ה-SQL הבא:

```sql
-- יצירת טבלת קופות צדקה
CREATE TABLE IF NOT EXISTS boxes (
  id SERIAL PRIMARY KEY,
  serial_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  responsible_phone VARCHAR(50),
  notes TEXT,
  is_evacuated BOOLEAN DEFAULT FALSE,
  last_evacuated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים לביצועים טובים
CREATE INDEX IF NOT EXISTS idx_boxes_serial_number ON boxes(serial_number);
CREATE INDEX IF NOT EXISTS idx_boxes_is_evacuated ON boxes(is_evacuated);
CREATE INDEX IF NOT EXISTS idx_boxes_last_evacuated_at ON boxes(last_evacuated_at);

-- פונקציה לעדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- טריגר על updated_at
DROP TRIGGER IF EXISTS update_boxes_updated_at ON boxes;
CREATE TRIGGER update_boxes_updated_at
  BEFORE UPDATE ON boxes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- הרשאות RLS (Row Level Security) - גישה ציבורית מלאה
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

-- מדיניות: כל אחד יכול לקרוא
CREATE POLICY "Allow public read" ON boxes
  FOR SELECT USING (true);

-- מדיניות: כל אחד יכול לכתוב (לשימוש פנימי ללא אוטנטיקציה)
CREATE POLICY "Allow public insert" ON boxes
  FOR INSERT WITH CHECK (true);

-- מדיניות: כל אחד יכול לעדכן
CREATE POLICY "Allow public update" ON boxes
  FOR UPDATE USING (true) WITH CHECK (true);

-- מדיניות: כל אחד יכול למחוק
CREATE POLICY "Allow public delete" ON boxes
  FOR DELETE USING (true);
```

---

## שלב 3: הגדרת קובץ .env

```bash
# העתק את קובץ הדוגמה
cp .env.example .env
```

ערוך את קובץ `.env` עם הפרטים שלך:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_ADMIN_EMAIL=your-email@example.com
```

---

## שלב 4: הפעלת האפליקציה

```bash
npm install
npm run dev
```

האפליקציה תיפתח בכתובת: http://localhost:5173

---

## מבנה הפרויקט

```
src/
├── lib/
│   ├── supabase.js      # Supabase client + DB functions
│   └── routeUtils.js    # TSP algorithm + navigation utilities
├── components/
│   ├── Map.jsx          # מפת Leaflet עם סמנים צבעוניים
│   ├── BoxList.jsx      # תצוגת רשימה
│   ├── BoxDetails.jsx   # פאנל פרטי קופה
│   ├── AddEditBox.jsx   # טופס הוספה/עריכה
│   ├── ReportModal.jsx  # מודאל דיווח תקלה
│   ├── RoutePlanner.jsx # תכנון מסלול עם Drag & Drop
│   └── NavigationMode.jsx # מצב ניווט full-screen
├── App.jsx              # קומפוננטת ראשית
├── main.jsx
└── index.css
```

---

## תכונות עיקריות

- **מפה אינטראקטיבית**: OpenStreetMap עם Leaflet, סמנים ירוקים/אדומים
- **ניהול קופות**: הוספה, עריכה, מחיקה, סימון פינוי
- **גיאוקודינג**: חיפוש כתובת אוטומטי עם Nominatim API
- **תכנון מסלול**: אלגוריתם TSP, Drag & Drop לסידור ידני
- **ייצוא**: Google Maps, Waze
- **מצב ניווט**: ממשק מלא לפינוי שטח
- **איפוס אוטומטי**: קופות לא פונות אחרי חודשיים
- **דיווח תקלות**: שליחת מייל מובנית

---

## נתוני דוגמה (אופציונלי)

```sql
INSERT INTO boxes (serial_number, name, address, latitude, longitude, responsible_phone, notes) VALUES
  ('TZ-001', 'בית כנסת מרכזי', 'רחוב הרצל 1, תל אביב', 32.0853, 34.7818, '050-1234567', 'ליד הכניסה הראשית'),
  ('TZ-002', 'מכולת כהן', 'שדרות רוטשילד 100, תל אביב', 32.0621, 34.7739, '052-9876543', ''),
  ('TZ-003', 'בית ספר יסודי', 'רחוב ביאליק 15, רמת גן', 32.0821, 34.8141, '054-1111111', 'קומה שנייה'),
  ('TZ-004', 'מרכז קהילתי', 'רחוב ויצמן 50, גבעתיים', 32.0715, 34.8099, '053-2222222', '');
```
