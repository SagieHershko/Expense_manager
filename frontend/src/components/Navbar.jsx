import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

export default function Navbar({
  onAddExpense,
  onExportCSV,
  exporting,
  expensesExist,
  activeTab,
  onTabChange,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("username");
  const { darkMode, toggleDarkMode } = useTheme();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      {/* כותרת + כפתורי פעולה מהירה */}
      <div className="navbar-title-group">
        <h1>💰 ניהול הוצאות</h1>
        {onAddExpense && (
          <button
            className="btn btn-navbar-add"
            onClick={onAddExpense}
            title="הוסף הוצאה חדשה"
          >
            הוסף הוצאה +
          </button>
        )}
        {onExportCSV && (
          <button
            className="btn btn-navbar-export"
            onClick={onExportCSV}
            disabled={exporting || !expensesExist}
            title="ייצוא דוח הוצאות"
          >
            {exporting ? "⏳..." : "📥 ייצוא דוח הוצאות"}
          </button>
        )}
      </div>

      {/* קישורים + כלים */}
      <div className="navbar-links">
        <Link
          to="/"
          className={`navbar-link-btn ${isActive("/") ? "active" : ""}`}
        >
          דשבורד
        </Link>
        <Link
          to="/categories"
          className={`navbar-link-btn ${isActive("/categories") ? "active" : ""}`}
        >
          קטגוריות
        </Link>

        {/* כפתורי מצב — אישי / משותף (מופיעים רק בדשבורד) */}
        {onTabChange ? (
          <div className="navbar-tabs">
            <button
              className={`navbar-tab-btn ${activeTab === "personal" ? "active" : ""}`}
              onClick={() => onTabChange("personal")}
              title="הוצאות אישיות"
            >
              📊 אישי
            </button>
            <button
              className={`navbar-tab-btn ${activeTab === "shared" ? "active" : ""}`}
              onClick={() => onTabChange("shared")}
              title="הוצאות משותפות"
            >
              💸 משותף
            </button>
          </div>
        ) : (
          <Link
            to="/?tab=shared"
            className="navbar-link-btn"
          >
            💸 משותף
          </Link>
        )}

        <button
          className="btn btn-dark-toggle"
          onClick={toggleDarkMode}
          title={darkMode ? "עבור למצב בהיר" : "עבור למצב כהה"}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>
        <span className="navbar-user">שלום, {username}</span>
        <button className="btn btn-navbar-logout" onClick={logout}>
          התנתק
        </button>
      </div>
    </nav>
  );
}
