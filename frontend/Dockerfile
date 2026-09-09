# ---- שלב 1: Build ----
# משתמשים ב-node לבניית הפרויקט
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# בונים את ה-React app לקבצים סטטיים (HTML/CSS/JS)
RUN npm run build

# ---- שלב 2: Serve ----
# nginx — שרת web קל ומהיר להגשת קבצים סטטיים
# Multi-stage build: השלב הזה הרבה יותר קטן מלהריץ node בפרודקשן
FROM nginx:alpine

# מעתיקים את הbuild מהשלב הקודם לנginx
COPY --from=builder /app/dist /usr/share/nginx/html

# הגדרת nginx לתמוך ב-React Router (SPA)
# בלי זה, רענון דף על /categories יחזיר 404
RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    try_files $uri /index.html; \
  } \
  location /api/ { \
    proxy_pass http://backend:3000; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
