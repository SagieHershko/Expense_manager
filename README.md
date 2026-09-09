# 💰 Personal Expense Manager

מערכת לניהול הוצאות אישיות — פרויקט גמר, קורס Fullstack.

## תיאור הפרויקט
אפליקציית Full-Stack המאפשרת למשתמשים לנהל את ההוצאות שלהם בצורה נוחה:
- הוספה, עריכה ומחיקה של הוצאות
- ניהול קטגוריות
- סינון לפי תאריך וקטגוריה
- אימות משתמשים (JWT)
- תצוגת גרפים וסיכומים

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite
- **Auth:** JWT
- **Container:** Docker + Docker Compose
- **CI/CD:** GitHub Actions

## הרצת הפרויקט

### דרך Docker (מומלץ)
```bash
docker compose up --build
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### הרצה מקומית

**Backend:**
```bash
cd backend
npm install
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## בדיקות
```bash
cd backend
npm test
```

## משתני סביבה
צור קובץ `backend/.env`:
```
PORT=3000
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```
