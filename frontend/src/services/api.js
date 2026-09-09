import axios from 'axios';

// יוצרים axios instance עם הגדרות ברירת מחדל
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor — מוסיף JWT token לכל בקשה אוטומטית
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — מטפל ב-401 (token פג תוקף)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const register = (username, password) =>
  api.post('/auth/register', { username, password });

export const login = (username, password) =>
  api.post('/auth/login', { username, password });

// --- Expenses ---
export const getExpenses = (filters = {}) =>
  api.get('/expenses', { params: filters });

export const createExpense = (data) =>
  api.post('/expenses', data);

export const updateExpense = (id, data) =>
  api.put(`/expenses/${id}`, data);

export const deleteExpense = (id) =>
  api.delete(`/expenses/${id}`);

// --- Categories ---
export const getCategories = () =>
  api.get('/categories');

export const createCategory = (name) =>
  api.post('/categories', { name });

export const deleteCategory = (id) =>
  api.delete(`/categories/${id}`);

export default api;
