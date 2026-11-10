/**
 * App.tsx — Router tối giản (không dùng react-router).
 *
 * Luồng:
 *   Đang kiểm tra token cũ → màn hình "Đang tải…"
 *   Chưa đăng nhập         → LoginPage
 *   Đã đăng nhập           → DashboardPage
 *
 * Không cần react-router ở bước này; sẽ thêm khi có nhiều trang hơn.
 */

import { useAuth } from './AuthContext'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="loading-screen">
        <span>Đang tải…</span>
      </div>
    )
  }

  return user ? <DashboardPage /> : <LoginPage />
}
