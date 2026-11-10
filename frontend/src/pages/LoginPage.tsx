/**
 * LoginPage.tsx — Màn hình Đăng nhập (Khớp 100% Mockup 1).
 *
 * Thiết kế Split-screen:
 * - Bên trái: Banner thương hiệu Face Attendance với background đại học hiện đại.
 * - Bên phải: Form đăng nhập tài khoản / mật khẩu, hỗ trợ ẩn/hiện mật khẩu,
 *   ghi nhớ đăng nhập và đăng nhập nhanh cho Giảng viên / Quản trị viên.
 */

import { type FormEvent, useState } from 'react'
import { isApiError } from '../api'
import { useAuth } from '../AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(username.trim().toLowerCase(), password)
      setPassword('')
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 401 || err.status === 403) {
          setError('Sai tên đăng nhập hoặc mật khẩu.')
        } else {
          setError(`Lỗi máy chủ (${err.status}). Thử lại sau.`)
        }
      } else {
        setError('Không kết nối được tới máy chủ. Vui lòng kiểm tra Spring Boot (cổng 8080).')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="split-login-container">
      {/* 1. Bên trái: Banner thương hiệu & Kiến trúc */}
      <div className="login-banner-side">
        <div className="banner-overlay"></div>
        <div className="banner-content">
          <div className="banner-brand-box">
            <div className="banner-logo-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <circle cx="12" cy="11" r="3" />
                <path d="M8.5 17a4 4 0 0 1 7 0" />
              </svg>
            </div>
            <h1 className="banner-title">Face Attendance</h1>
            <p className="banner-subtitle">
              Hệ thống điểm danh bằng
              <br />
              nhận diện khuôn mặt
            </p>
          </div>
        </div>
      </div>

      {/* 2. Bên phải: Khối form đăng nhập */}
      <div className="login-form-side">
        <div className="login-box-card">
          <div className="login-box-header">
            <h2 className="login-box-title">Đăng nhập</h2>
            <p className="login-box-subtitle">Vui lòng đăng nhập để sử dụng hệ thống</p>
          </div>

          {error && <div className="login-error-alert">{error}</div>}

          <form onSubmit={handleSubmit} className="login-actual-form">
            {/* Tên đăng nhập */}
            <div className="login-input-group">
              <label className="input-group-label" htmlFor="username">
                Tên đăng nhập
              </label>
              <div className="input-with-icon">
                <svg className="field-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="username"
                  type="text"
                  placeholder="Ví dụ: giangvien hoặc admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Mật khẩu */}
            <div className="login-input-group">
              <label className="input-group-label" htmlFor="password">
                Mật khẩu
              </label>
              <div className="input-with-icon">
                <svg className="field-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu của bạn"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Ghi nhớ & Quên mật khẩu */}
            <div className="login-extra-row">
              <label className="remember-me-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Vui lòng liên hệ Quản trị viên để đặt lại mật khẩu.') }} className="forgot-pass-link">
                Quên mật khẩu?
              </a>
            </div>

            {/* Nút Đăng nhập */}
            <button type="submit" className="login-submit-btn" disabled={busy}>
              {busy ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>

            {/* Hoặc đăng nhập bằng Google (Khớp Mockup 1) */}
            <div className="login-divider-row">
              <span className="divider-line"></span>
              <span className="divider-label">Hoặc đăng nhập bằng</span>
              <span className="divider-line"></span>
            </div>

            <button
              type="button"
              className="google-login-btn"
              onClick={() => {
                alert('Chế độ Local/Nội bộ: Hiện tại hệ thống ưu tiên đăng nhập trực tiếp bằng tài khoản Giảng viên hoặc Quản trị viên (Admin).')
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>

            {/* Tùy chọn đăng nhập nhanh demo */}
            <div className="demo-accounts-pill">
              <span>Đăng nhập nhanh: </span>
              <button
                type="button"
                className="chip-btn"
                onClick={() => {
                  setUsername('admin')
                  setPassword('admin123')
                }}
              >
                Admin
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => {
                  setUsername('taquocy')
                  setPassword('123456')
                }}
              >
                GV. Tạ Quốc Ý
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
