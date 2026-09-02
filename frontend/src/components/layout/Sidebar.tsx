import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">🔐</span>
        <span className="logo-text">Gemini Vault</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⬛</span> Dashboard
          </NavLink>
          <NavLink to="/journal" className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📔</span> Journal Vault
          </NavLink>
          <NavLink to="/conversations" className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💬</span> Conversations
          </NavLink>
          <NavLink to="/integrity" className={({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🔗</span> Integrity Vault
          </NavLink>
      </nav>

      <div className="sidebar-user">
        {user?.photoURL && (
          <img src={user.photoURL} alt="avatar" className="user-avatar" referrerPolicy="no-referrer" />
        )}
        <div className="user-info">
          <div className="user-name">{user?.displayName ?? 'User'}</div>
          <div className="user-email">{user?.email}</div>
        </div>
        <button onClick={handleLogout} className="btn-logout" title="Sign out">↩</button>
      </div>
    </aside>
  );
}
