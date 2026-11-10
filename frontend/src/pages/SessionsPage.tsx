/**
 * SessionsPage.tsx — Quản lý Buổi học & Phiên điểm danh (Khớp 100% Mockup 7).
 *
 * Tính năng:
 * - Lọc theo Lớp học và Trạng thái buổi học (Đã diễn ra, Đang diễn ra, Chưa diễn ra)
 * - Nút "+ Tạo buổi học" mở Modal tạo phiên điểm danh mới
 * - Nút "Điểm danh" / "Xem" chuyển thẳng sang màn hình Điểm danh Live Camera (Mockup 3)
 */

import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { readAttendanceSelection, saveAttendanceSelection } from '../attendanceSelection'
import {
  createSession,
  getClasses,
  getSessions,
  isApiError,
  type AttendanceSession,
  type SchoolClass,
} from '../api'

interface Props {
  onNavigateAttendance: () => void
}

export default function SessionsPage({ onNavigateAttendance }: Props) {
  const { user } = useAuth()
  function selectSession(session: AttendanceSession) {
    saveAttendanceSelection(user!.username, { classId: session.classId, sessionId: session.id })
    onNavigateAttendance()
  }
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONGOING' | 'COMPLETED'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 10

  // Modal Tạo buổi học mới
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSessionClassId, setNewSessionClassId] = useState<number | null>(null)
  const [newSessionTitle, setNewSessionTitle] = useState('')

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    getClasses(0, 50).then((res) => {
      setClasses(res.items)
      if (res.items.length > 0) {
        setSelectedClassId(res.items.find((c) => c.id === readAttendanceSelection(user!.username)?.classId)?.id ?? res.items[0].id)
        setNewSessionClassId(res.items[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (selectedClassId !== null) {
      loadSessions(selectedClassId)
    }
  }, [selectedClassId])

  async function loadSessions(classId: number) {
    try {
      const res = await getSessions(classId)
      setSessions(res.items)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi tải danh sách buổi học')
    }
  }

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    if (!newSessionClassId || !newSessionTitle.trim()) return
    setErrorMsg(null)
    try {
      await createSession(newSessionClassId, newSessionTitle.trim())
      setNewSessionTitle('')
      setShowCreateModal(false)
      setSuccessMsg('Đã tạo buổi học mới thành công!')
      if (selectedClassId) loadSessions(selectedClassId)
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể tạo buổi học')
    }
  }

  const displaySessions = sessions
    .map((session) => ({
      ...session,
      classCode: classes.find((c) => c.id === session.classId)?.classCode || '',
      status: session.closedAt !== null ? 'COMPLETED' : 'ONGOING',
      timeStr: `${new Date(session.openedAt).toLocaleDateString('vi-VN')} ${new Date(session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    }))
    .filter((s) => (statusFilter === 'ALL' ? true : s.status === statusFilter))

  const totalPages = Math.max(1, Math.ceil(displaySessions.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginatedSessions = displaySessions.slice(startIndex, startIndex + PAGE_SIZE)

  return (
    <div className="management-page-container">
      {errorMsg && <div className="floating-toast toast-error">{errorMsg}</div>}
      {successMsg && <div className="floating-toast toast-success">{successMsg}</div>}

      {/* 1. Thanh lọc & nút Tạo buổi học */}
      <div className="table-filter-toolbar">
        <div className="filter-dropdowns">
          <div className="filter-group-inline">
            <label>Lớp học:</label>
            <select
              className="filter-select"
              value={selectedClassId ?? ''}
              onChange={(e) => {
                setSelectedClassId(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.classCode} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group-inline">
            <label>Trạng thái:</label>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'ONGOING' | 'COMPLETED')
                setCurrentPage(1)
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="ONGOING">Đang diễn ra</option>
              <option value="COMPLETED">Đã diễn ra</option>
            </select>
          </div>
        </div>

        <button className="primary-action-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Tạo buổi học</span>
        </button>
      </div>

      {/* 2. Bảng Danh sách buổi học */}
      <div className="standard-table-card">
        <table className="standard-data-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>#</th>
              <th style={{ width: '120px' }}>Lớp học</th>
              <th style={{ width: '130px' }}>Buổi</th>
              <th>Thời gian</th>
              <th style={{ width: '150px' }}>Trạng thái</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Điểm danh</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSessions.map((session, idx) => (
              <tr key={session.id || idx}>
                <td>{startIndex + idx + 1}</td>
                <td>
                  <strong className="code-badge-text">{session.classCode}</strong>
                </td>
                <td className="bold-name-cell">{session.title}</td>
                <td>{session.timeStr}</td>
                <td>
                  {session.status === 'COMPLETED' ? (
                    <span className="status-badge-green">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Đã diễn ra
                    </span>
                  ) : session.status === 'ONGOING' ? (
                    <span className="status-badge-amber">
                      <span className="live-dot-pulse"></span>
                      Đang diễn ra
                    </span>
                  ) : (
                    <span className="status-badge-gray">Chưa diễn ra</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {session.status === 'ONGOING' ? (
                    <button className="btn-attendance-action" onClick={() => selectSession(session)}>
                      Điểm danh
                    </button>
                  ) : (
                    <button className="btn-view-action" onClick={() => selectSession(session)}>
                      Xem
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Phân trang */}
        <div className="table-pagination-footer">
          <span className="pagination-info">
            Hiển thị {displaySessions.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + PAGE_SIZE, displaySessions.length)} / {displaySessions.length} buổi học
          </span>
          <div className="pagination-pages">
            <button
              className="page-btn"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`page-btn ${p === safePage ? 'active' : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Modal Tạo buổi học mới */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateSession}>
              <div className="modal-header">
                <h3>Tạo buổi học & phiên điểm danh mới</h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div>
                  <label><strong>Chọn lớp học:</strong></label>
                  <select
                    className="full-width-select"
                    value={newSessionClassId ?? ''}
                    onChange={(e) => setNewSessionClassId(Number(e.target.value))}
                    required
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.classCode} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label><strong>Tiêu đề buổi học:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: Buổi 07 - Tối ưu mạng nơ-ron CNN"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Tạo buổi học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
