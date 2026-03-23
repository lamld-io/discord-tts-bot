import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, createContext, useContext } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { GuildPage } from './pages/GuildPage';
import { api } from './api/client';
import type { User } from './types';

// Auth Context
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  logout: () => void;
}>({ user: null, loading: true, logout: () => {} });

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api.auth.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Layout with Header
function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="header-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontSize: '1.5rem' }}>🎙️</span>
          <span>TTS Bot Dashboard</span>
        </Link>

        <div className="header-nav">
          {user && (
            <div className="header-user">
              {user.avatar ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`}
                  alt={user.username}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--gradient-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 600, color: 'white'
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{user.username}</span>
              <button className="btn btn-secondary btn-small" onClick={handleLogout}>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

// Protected Route
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

// Main App
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guild/:id"
            element={
              <ProtectedRoute>
                <GuildPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
