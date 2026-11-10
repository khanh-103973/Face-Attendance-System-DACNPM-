/**
 * TopHeader.tsx — Thanh tiêu đề phía trên cùng.
 * Hiển thị tiêu đề trang, breadcrumb, chuông thông báo, đồng hồ thời gian thực và avatar.
 */

import { useEffect, useState } from 'react'

interface Props {
  title: string
  breadcrumb: string
}

export default function TopHeader({ title, breadcrumb }: Props) {
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    function updateClock() {
      const now = new Date()
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
      const dayName = days[now.getDay()]
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const year = now.getFullYear()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')

      setTimeStr(`${dayName}, ${day}/${month}/${year}  ${hours}:${minutes}`)
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="top-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
        <div className="header-breadcrumb">{breadcrumb}</div>
      </div>

      <div className="header-right">
        {/* Chuông thông báo */}
        <button className="header-icon-btn" title="Thông báo" aria-label="Thông báo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notif-badge-dot"></span>
        </button>

        {/* Đồng hồ thời gian thực */}
        <div className="header-clock-pill">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{timeStr || 'Đang cập nhật...'}</span>
        </div>

        {/* Avatar người dùng */}
        <div className="header-avatar-circle" title="Tài khoản">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>
    </header>
  )
}
