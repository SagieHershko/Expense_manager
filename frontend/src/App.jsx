import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Login      from './pages/Login';
import Register   from './pages/Register';
import Dashboard  from './pages/Dashboard';
import Categories from './pages/Categories';
import SharedExpenses from './pages/SharedExpenses';

// Protected Route — אם אין token מפנה לדף login
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Routes ציבוריים */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Routes מוגנים */}
          <Route path="/" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />
          <Route path="/categories" element={
            <PrivateRoute><Categories /></PrivateRoute>
          } />

          <Route path="/shared" element={
            <PrivateRoute><SharedExpenses /></PrivateRoute>
          } />

          {/* כל route לא מוכר → דשבורד */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
