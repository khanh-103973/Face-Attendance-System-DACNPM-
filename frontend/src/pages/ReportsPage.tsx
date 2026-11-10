/**
 * ReportsPage.tsx — Thống kê & Báo cáo Chuyên cần (Khớp 100% Mockup 8).
 *
 * Tính năng:
 * - Lấy dữ liệu THẬT 100% từ Database qua API /api/reports/attendance
 * - Bộ lọc khoảng ngày (Từ ngày - Đến ngày) và Lớp học (Tất cả lớp hoặc từng lớp)
 * - Nút "Xuất Excel" (CSV UTF-8 BOM tải trực tiếp không lỗi font tiếng Việt) từ dữ liệu điểm danh thật
 * - Nút "Xuất PDF" hỗ trợ in và lưu báo cáo PDF trực tiếp từ trình duyệt
 * - 4 thẻ số liệu tổng hợp tính toán tự động từ CSDL: Tổng SV, Có mặt TB, Đi muộn, Tỷ lệ vắng mặt
 * - Biểu đồ cột Tỷ lệ chuyên cần theo từng buổi học thực tế (SVG tương tác)
 * - Đồng hồ tròn Donut phân bổ tỷ lệ: Có mặt (Xanh lá), Đi muộn (Cam), Vắng mặt (Đỏ)
 * - Bảng danh sách chi tiết bản ghi điểm danh bên dưới để người dùng theo dõi và kiểm tra
 */

import { useEffect, useState } from 'react'
import {
  getAttendanceReport,
  getClasses,
  isApiError,
  type AttendanceReportData,
  type SchoolClass,
} from '../api'
import { exportAttendanceToCsv, type ExportRow } from '../exportUtils'

export default function ReportsPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)

  // Khoảng ngày mặc định: 30 ngày gần nhất đến hôm nay
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [report, setReport] = useState<AttendanceReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    getClasses(0, 50)
      .then((res) => {
        setClasses(res.items)
      })
      .catch((err) => {
        console.error('Lỗi tải danh sách lớp:', err)
      })
  }, [])

  useEffect(() => {
    loadReportData()
  }, [selectedClassId, fromDate, toDate])

  async function loadReportData() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await getAttendanceReport(selectedClassId, fromDate, toDate)
      setReport(data)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi tải dữ liệu báo cáo thống kê')
    } finally {
      setLoading(false)
    }
  }

  function handleExportExcel() {
    if (!report || report.records.length === 0) {
      alert('Chưa có bản ghi điểm danh nào trong khoảng thời gian đã chọn để xuất file!')
      return
    }

    const curClass = classes.find((c) => c.id === selectedClassId)
    const className = curClass ? `${curClass.classCode} - ${curClass.name}` : 'Tất cả các lớp'
    const title = `Báo cáo chuyên cần (${fromDate} đến ${toDate})`

    const rows: ExportRow[] = report.records.map((r, idx) => ({
      index: idx + 1,
      studentCode: r.studentCode,
      fullName: r.fullName,
      status: r.status === 'PRESENT' ? 'Có mặt' : 'Đi muộn',
      recordedAt: new Date(r.recordedAt).toLocaleString('vi-VN'),
      cosine: r.cosine ? r.cosine.toFixed(3) : '-',
      method: r.method || 'Nhận diện khuôn mặt',
    }))

    exportAttendanceToCsv(title, className, rows)
    setSuccessMsg(`Đã xuất báo cáo Excel cho ${rows.length} lượt điểm danh thành công!`)
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  function handleExportPdf() {
    window.print()
  }

  // Tính toán vòng tròn Donut SVG
  const presentRate = report?.presentRate ?? 0
  const lateRate = report?.lateRate ?? 0
  const absentRate = report?.absentRate ?? 0
  const pendingRate = report?.pendingRate ?? 0

  const circumference = 251.2
  // dashoffset cho đường tròn có mặt
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, presentRate))) / 100

  const sessionBars = report?.sessionBars ?? []

  return (
    <div className="management-page-container">
      {/* Thông báo nổi */}
      {errorMsg && <div className="floating-toast toast-error">{errorMsg}</div>}
      {successMsg && <div className="floating-toast toast-success">{successMsg}</div>}

      {/* 1. Thanh lọc & nút Xuất báo cáo */}
      <div className="table-filter-toolbar">
        <div className="filter-dropdowns">
          <div className="filter-group-inline">
            <label>Từ:</label>
            <input
              type="date"
              className="filter-date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group-inline">
            <label>Đến:</label>
            <input
              type="date"
              className="filter-date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="filter-group-inline">
            <label>Lớp:</label>
            <select
              className="filter-select"
              value={selectedClassId ?? ''}
              onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Tất cả các lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.classCode}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="export-buttons-group">
          <button className="btn-export-excel" onClick={handleExportExcel} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Xuất Excel</span>
          </button>
          <button className="btn-export-pdf" onClick={handleExportPdf} title="In hoặc lưu file PDF">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Thẻ chỉ số tổng hợp (DỮ LIỆU THẬT TỪ DATABASE) */}
      <div className="report-metric-grid">
        <div className="report-metric-card">
          <div className="report-metric-icon blue-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <span className="report-metric-val">{report ? report.totalStudents : '-'}</span>
            <span className="report-metric-label">Tổng sinh viên</span>
          </div>
        </div>

        <div className="report-metric-card">
          <div className="report-metric-icon green-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="report-metric-val">{report ? report.avgPresent : '-'}</span>
            <span className="report-metric-label">Có mặt trung bình</span>
          </div>
        </div>

        <div className="report-metric-card">
          <div className="report-metric-icon orange-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <span className="report-metric-val">{report ? report.totalLate : '-'}</span>
            <span className="report-metric-label">Đi muộn</span>
          </div>
        </div>

        <div className="report-metric-card">
          <div className="report-metric-icon red-bubble">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div>
            <span className="report-metric-val">{report ? `${report.absentRate}%` : '-'}</span>
            <span className="report-metric-label">
              Tỷ lệ vắng mặt
              {report && report.openSessions > 0 ? ` (${report.totalPending} chưa điểm danh)` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Phần biểu đồ: Biểu đồ cột (Trái) & Tổng quan chuyên cần (Phải) */}
      <div className="report-charts-grid">
        {/* Biểu đồ cột: Tỷ lệ chuyên cần theo buổi học */}
        <div className="standard-table-card chart-col-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 className="chart-title">Tỷ lệ chuyên cần theo buổi học</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {sessionBars.length} buổi học ({report?.closedSessions ?? 0} đã đóng, {report?.openSessions ?? 0} đang mở)
            </span>
          </div>

          {sessionBars.length > 0 ? (
            <div className="bar-chart-container">
              <div className="bar-chart-y-axis">
                <span>100%</span>
                <span>80%</span>
                <span>60%</span>
                <span>40%</span>
                <span>20%</span>
                <span>0%</span>
              </div>
              <div className="bar-chart-bars-wrap">
                {sessionBars.map((b) => (
                  <div
                    key={b.sessionId}
                    className="bar-column-item"
                    title={`${b.title} (${b.classCode} - ${b.closed ? 'Đã đóng' : 'Đang mở'}): ${b.presentCount} có mặt, ${b.lateCount} đi muộn, ${b.closed ? `${b.absentCount} vắng mặt` : `${b.pendingCount} chưa điểm danh`} / ${b.totalStudents} sinh viên`}
                  >
                    <span className="bar-top-rate">{b.rate}%</span>
                    <div className="bar-track">
                      <div className="bar-fill-blue" style={{ height: `${Math.min(100, Math.max(0, b.rate))}%` }}></div>
                    </div>
                    <span className="bar-bottom-title">
                      {b.title}
                      {!b.closed ? ' (Đang mở)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.6 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p style={{ margin: 0, fontWeight: 500 }}>Chưa có buổi học nào trong khoảng thời gian đã chọn</p>
              <span style={{ fontSize: '12px' }}>Hãy chọn khoảng thời gian khác hoặc tạo buổi học để điểm danh.</span>
            </div>
          )}
        </div>

        {/* Tổng quan chuyên cần (Donut) */}
        <div className="standard-table-card donut-col-card">
          <h3 className="chart-title">Tổng quan chuyên cần</h3>
          <div className="donut-center-wrap">
            <div className="large-donut-box">
              <svg width="140" height="140" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                {/* Vòng xanh lá biểu thị tỷ lệ có mặt */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray="251.2"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="donut-inner-text">
                <span className="donut-val-big">{presentRate}%</span>
                <span className="donut-sub-text">Có mặt</span>
              </div>
            </div>

            <div className="donut-legend-list">
              <div className="legend-row">
                <span className="legend-color-dot dot-green"></span>
                <span>
                  Có mặt: <strong>{presentRate}%</strong>
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-color-dot dot-orange"></span>
                <span>
                  Đi muộn: <strong>{lateRate}%</strong>
                </span>
              </div>
              <div className="legend-row">
                <span className="legend-color-dot dot-red"></span>
                <span>
                  Vắng mặt (phiên đã đóng): <strong>{absentRate}%</strong>
                </span>
              </div>
              {(report?.openSessions ?? 0) > 0 && (
                <div className="legend-row">
                  <span className="legend-color-dot" style={{ background: '#94a3b8' }}></span>
                  <span>
                    Chưa điểm danh (phiên mở): <strong>{pendingRate}%</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bảng danh sách chi tiết bản ghi điểm danh (Dữ liệu thật từ Database) */}
      {report && report.records.length > 0 && (
        <div className="standard-table-card" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>
              Chi tiết các lượt điểm danh ghi nhận ({report.records.length} lượt)
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Dữ liệu đồng bộ trực tiếp từ Database
            </span>
          </div>
          <table className="standard-data-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th style={{ width: '120px' }}>Mã SV</th>
                <th>Họ và tên</th>
                <th style={{ width: '110px' }}>Lớp</th>
                <th style={{ width: '140px' }}>Buổi học</th>
                <th style={{ width: '160px' }}>Thời gian ghi nhận</th>
                <th style={{ width: '110px' }}>Độ khớp</th>
                <th style={{ width: '130px' }}>Phương thức</th>
                <th style={{ width: '120px' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {report.records.map((r, idx) => (
                <tr key={r.id || idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong className="code-badge-text">{r.studentCode}</strong>
                  </td>
                  <td className="bold-name-cell">{r.fullName}</td>
                  <td>
                    <span className="class-pill-tag">{r.classCode}</span>
                  </td>
                  <td>{r.sessionTitle}</td>
                  <td>
                    {new Date(r.recordedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}{' '}
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                      ({new Date(r.recordedAt).toLocaleDateString('vi-VN')})
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {r.cosine > 0 ? r.cosine.toFixed(3) : '-'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569' }}>{r.method}</span>
                  </td>
                  <td>
                    {r.status === 'PRESENT' ? (
                      <span className="status-badge-green">Có mặt</span>
                    ) : (
                      <span className="status-badge-orange" style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                        Đi muộn
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
