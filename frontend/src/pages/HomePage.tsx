/**
 * HomePage.tsx — Trang chủ (Dashboard) Khớp 100% Mockup 2.
 *
 * Tính năng:
 * - Lời chào cá nhân hóa cho Giảng viên / Quản trị viên
 * - 4 thẻ chỉ số nhanh: Tổng SV, Lớp học, Buổi học hôm nay, Tỷ lệ chuyên cần
 * - Biểu đồ đường Tỷ lệ chuyên cần 7 ngày qua (SVG tinh gọn)
 * - Khối Hoạt động gần đây với mốc thời gian chi tiết
 * - Nút chuyển nhanh sang trang Điểm danh camera
 */

import { useEffect, useState } from 'react'
import {
  getAttendanceReport,
  getClasses,
  getStudents,
  type AttendanceReportData,
} from '../api'
import { useAuth } from '../AuthContext'

interface Props {
  onNavigateAttendance: () => void
  onNavigateClasses: () => void
  onNavigateStudents: () => void
}

export default function HomePage({ onNavigateAttendance, onNavigateClasses, onNavigateStudents }: Props) {
  const { user } = useAuth()
  const [totalClasses, setTotalClasses] = useState<number>(0)
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [report, setReport] = useState<AttendanceReportData | null>(null)

  useEffect(() => {
    getClasses(0, 1).then((res) => setTotalClasses(res.totalElements)).catch(() => {})
    getStudents(0, 1).then((res) => setTotalStudents(res.totalElements)).catch(() => {})
    getAttendanceReport(null).then((data) => setReport(data)).catch(() => {})
  }, [])

  const displayName =
    user?.role === 'TEACHER'
      ? `GV. ${user.username}`
      : user?.username === 'admin'
        ? 'Quản trị viên'
        : user?.username ?? 'Thầy/Cô'

  const todayStr = new Date().toLocaleDateString('vi-VN')
  const todaySessionsCount = report
    ? report.sessionBars.filter((s) => new Date(s.date).toLocaleDateString('vi-VN') === todayStr).length
    : 0
  const attendanceRate = report
    ? Math.min(100, Math.round((report.presentRate + report.lateRate) * 10) / 10)
    : 0
  const recentRecords = report ? [...report.records].reverse().slice(0, 5) : []
  const recentBars = report ? report.sessionBars.slice(-7) : []

  return (
    <div className="home-dashboard-layout">
      {/* 1. Lời chào đầu trang */}
      <div className="welcome-banner-card">
        <div className="welcome-text-group">
          <h2 className="welcome-title">
            Xin chào, {displayName} <span className="wave-hand">👋</span>
          </h2>
          <p className="welcome-subtitle">Chào mừng bạn quay lại hệ thống điểm danh!</p>
        </div>
        <button className="welcome-quick-btn" onClick={onNavigateAttendance}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>Điểm danh ngay</span>
        </button>
      </div>

      {/* 2. 4 Thẻ chỉ số tổng quan */}
      <div className="home-stats-grid">
        {/* Card 1: Tổng sinh viên */}
        <div className="home-stat-box" onClick={onNavigateStudents} style={{ cursor: 'pointer' }}>
          <div className="home-stat-icon icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="home-stat-info">
            <span className="home-stat-num">{totalStudents}</span>
            <span className="home-stat-label">Tổng sinh viên</span>
          </div>
        </div>

        {/* Card 2: Lớp học */}
        <div className="home-stat-box" onClick={onNavigateClasses} style={{ cursor: 'pointer' }}>
          <div className="home-stat-icon icon-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="home-stat-info">
            <span className="home-stat-num">{totalClasses}</span>
            <span className="home-stat-label">Lớp học</span>
          </div>
        </div>

        {/* Card 3: Buổi học hôm nay */}
        <div className="home-stat-box">
          <div className="home-stat-icon icon-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="home-stat-info">
            <span className="home-stat-num">{todaySessionsCount}</span>
            <span className="home-stat-label">Buổi học hôm nay</span>
          </div>
        </div>

        {/* Card 4: Tỷ lệ chuyên cần */}
        <div className="home-stat-box">
          <div className="home-stat-icon icon-teal">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="home-stat-info">
            <span className="home-stat-num">{attendanceRate}%</span>
            <span className="home-stat-label">Tỷ lệ chuyên cần</span>
          </div>
        </div>
      </div>

      {/* 3. Phần thân: Biểu đồ các buổi gần nhất (Trái) & Hoạt động gần đây (Phải) */}
      <div className="home-charts-grid">
        {/* Biểu đồ chuyên cần các buổi học gần đây */}
        <div className="home-chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Tỷ lệ chuyên cần các buổi gần đây</h3>
          </div>
          <div className="svg-chart-container">
            {recentBars.length > 0 ? (
              <div className="bar-chart-container" style={{ height: '190px' }}>
                <div className="bar-chart-y-axis">
                  <span>100%</span>
                  <span>80%</span>
                  <span>60%</span>
                  <span>40%</span>
                  <span>20%</span>
                  <span>0%</span>
                </div>
                <div className="bar-chart-bars-wrap">
                  {recentBars.map((b) => (
                    <div
                      key={b.sessionId}
                      className="bar-column-item"
                      title={`${b.title} (${b.classCode}): ${b.presentCount + b.lateCount}/${b.totalStudents} SV (${b.rate}%)`}
                    >
                      <span className="bar-top-rate">{b.rate}%</span>
                      <div className="bar-track">
                        <div className="bar-fill-blue" style={{ height: `${Math.min(100, Math.max(0, b.rate))}%` }}></div>
                      </div>
                      <span className="bar-bottom-title">{b.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
                Chưa có dữ liệu buổi học nào.
              </div>
            )}
          </div>
        </div>

        {/* Hoạt động gần đây */}
        <div className="home-activity-card">
          <div className="chart-header">
            <h3 className="chart-title">Hoạt động điểm danh gần đây</h3>
          </div>
          <div className="activity-list">
            {recentRecords.length > 0 ? (
              recentRecords.map((rec) => (
                <div key={rec.id} className="activity-item">
                  <div className="activity-icon-bubble green-bubble">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">
                      {rec.studentCode} - {rec.fullName} ({rec.classCode} / {rec.sessionTitle})
                    </div>
                    <div className="activity-time">
                      {new Date(rec.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(rec.recordedAt).toLocaleDateString('vi-VN')} ({rec.method})
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Chưa có lượt điểm danh nào được ghi nhận.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
