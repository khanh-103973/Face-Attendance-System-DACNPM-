/**
 * Sidebar.tsx — Thanh điều hướng bên trái giao diện (Dark Navy Theme).
 *
 * Khớp hoàn toàn với thiết kế mockup:
 * - Logo Face Attendance + Slogan
 * - Danh sách điều hướng: Trang chủ, Điểm danh, Sinh viên, Lớp học, Buổi học, Thống kê, Quản trị
 * - Thẻ tài khoản người dùng ở góc dưới với nút Đăng xuất
 */

import { useAuth } from '../AuthContext'

export type NavTab =
  | 'home'
  | 'attendance'
  | 'students'
  | 'classes'
  | 'sessions'
  | 'reports'
  | 'admin'

interface Props {
  activeTab: NavTab
  onSelectTab: (tab: NavTab) => void
}

export default function Sidebar({ activeTab, onSelectTab }: Props) {
  const { user, signOut } = useAuth()

  const displayName =
    user?.role === 'TEACHER'
      ? `GV. ${user.username}`
      : user?.username === 'admin'
        ? 'Admin Quản trị viên'
        : user?.username ?? 'Người dùng'

  const roleLabel = user?.role === 'ADMIN' ? 'Quản trị viên' : 'Giảng viên'

  return (
    <aside className="app-sidebar">
      {/* 1. Header Logo & Slogan */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Khung scan khuôn mặt */}
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            {/* Mặt người quét AI */}
            <circle cx="12" cy="11" r="3" />
            <path d="M8.5 17a4 4 0 0 1 7 0" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <div className="brand-title">Face Attendance</div>
          <div className="brand-subtitle">
            Hệ thống điểm danh bằng
            <br />
            nhận diện khuôn mặt
          </div>
        </div>
      </div>

      {/* 2. Menu Điều Hướng */}
      <nav className="sidebar-nav">
        {/* Trang chủ */}
        <button
          className={`sidebar-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onSelectTab('home')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Trang chủ</span>
        </button>

        {/* Điểm danh */}
        <button
          className={`sidebar-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => onSelectTab('attendance')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>Điểm danh</span>
        </button>

        {/* Sinh viên */}
        <button
          className={`sidebar-nav-item ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => onSelectTab('students')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Sinh viên</span>
        </button>

        {/* Lớp học */}
        <button
          className={`sidebar-nav-item ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => onSelectTab('classes')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Lớp học</span>
        </button>

        {/* Buổi học */}
        <button
          className={`sidebar-nav-item ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => onSelectTab('sessions')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Buổi học</span>
        </button>

        {/* Thống kê & Báo cáo */}
        <button
          className={`sidebar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => onSelectTab('reports')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Thống kê & Báo cáo</span>
          <svg className="chevron-right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Quản trị hệ thống */}
        {user?.role === 'ADMIN' && (
          <button
            className={`sidebar-nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => onSelectTab('admin')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Quản trị hệ thống</span>
            <svg className="chevron-right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </nav>

      {/* 3. Thẻ Thông Tin Người Dùng & Nút Đăng Xuất */}
      <div className="sidebar-profile-card">
        <div className="sidebar-user-info">
          <div className="sidebar-user-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="sidebar-user-details">
            <div className="sidebar-user-name" title={displayName}>
              {displayName}
            </div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
        </div>
        <button className="sidebar-logout-btn" onClick={signOut} title="Đăng xuất" aria-label="Đăng xuất">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
