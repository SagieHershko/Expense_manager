# ---- שלב 1: בסיס ----
# node:20-alpine — גרסת Node קטנה ויעילה (Alpine Linux)
FROM node:20-alpine

# התקנת build tools הנדרשים ל-better-sqlite3 (ספריית native)
RUN apk add --no-cache python3 make g++

# תיקיית עבודה בתוך ה-Container
WORKDIR /app

# מעתיקים את קובצי התלויות קודם (לניצול cache של Docker)
# אם package.json לא השתנה — Docker לא יריץ npm install מחדש
COPY package*.json ./
RUN npm install

# מעתיקים את שאר הקוד
COPY . .

# יוצרים תיקיית logs (נדרש ל-Winston)
RUN mkdir -p logs

# פורט שהאפליקציה מאזינה עליו (תיעוד בלבד — לא פותח פורט בפועל)
EXPOSE 3000

# הפקודה להרצת השרת
CMD ["node", "src/app.js"]
