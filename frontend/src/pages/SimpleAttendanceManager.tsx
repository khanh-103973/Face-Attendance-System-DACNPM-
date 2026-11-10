/**
 * SimpleAttendanceManager.tsx — Quản lý Phiên điểm danh, Báo cáo chuyên cần & Xuất CSV/Excel.
 */

import { type FormEvent, useEffect, useState } from 'react'
import {
  closeSession,
  createSession,
  getClasses,
  getClassMembers,
  getSessionRecords,
  getSessions,
  isApiError,
  manualRecordAttendance,
  type AttendanceRecord,
  type AttendanceSession,
  type SchoolClass,
  type Student,
} from '../api'
import { exportAttendanceToCsv, type ExportRow } from '../exportUtils'
import AttendanceLiveCamera from './AttendanceLiveCamera'

export default function SimpleAttendanceManager() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [classMembers, setClassMembers] = useState<Student[]>([])

  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  const [newTitle, setNewTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // 1. Tải danh sách lớp
  useEffect(() => {
    getClasses().then((res) => {
      setClasses(res.items)
      if (res.items.length > 0 && selectedClassId === null) {
        setSelectedClassId(res.items[0].id)
      }
    })
  }, [])

  // 2. Tải danh sách phiên & thành viên lớp khi chọn lớp
  useEffect(() => {
    if (selectedClassId !== null) {
      loadSessions(selectedClassId)
      getClassMembers(selectedClassId)
        .then((res) => setClassMembers(res.items))
        .catch(() => setClassMembers([]))
    }
  }, [selectedClassId])

  // 3. Tải danh sách bản ghi khi chọn phiên
  useEffect(() => {
    if (currentSession !== null) {
      loadRecords(currentSession.id)
    } else {
      setRecords([])
    }
  }, [currentSession])

  async function loadSessions(classId: number) {
    setError(null)
    try {
      const res = await getSessions(classId)
      setSessions(res.items)
      const open = res.items.find((s) => s.closedAt === null)
      if (open) {
        setCurrentSession(open)
      } else if (res.items.length > 0) {
        setCurrentSession(res.items[0])
      } else {
        setCurrentSession(null)
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Lỗi tải danh sách phiên')
    }
  }

  async function loadRecords(sessionId: number) {
    try {
      const res = await getSessionRecords(sessionId)
      setRecords(res.items)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Lỗi tải danh sách điểm danh')
    }
  }

  async function handleCreateSession(e: FormEvent) {
    e.preventDefault()
    if (!selectedClassId || !newTitle.trim()) return
    setError(null)
    setMessage(null)
    try {
      const created = await createSession(selectedClassId, newTitle.trim())
      setNewTitle('')
      setMessage('Mở phiên điểm danh mới thành công!')
      setCurrentSession(created)
      loadSessions(selectedClassId)
    } catch (err) {
      setError(isApiError(err) ? `Lỗi: ${err.message}` : 'Không thể tạo phiên')
    }
  }

  async function handleCloseSession(sessionId: number) {
    setError(null)
    setMessage(null)
    try {
      const closed = await closeSession(sessionId)
      setMessage('Đã đóng phiên điểm danh!')
      setCurrentSession(closed)
      if (selectedClassId) loadSessions(selectedClassId)
    } catch (err) {
      setError(isApiError(err) ? `Lỗi: ${err.message}` : 'Không thể đóng phiên')
    }
  }

  function handleNewRecord(newRec: AttendanceRecord) {
    setRecords((prev) => {
      if (prev.some((r) => r.id === newRec.id)) {
        return prev.map((r) => (r.id === newRec.id ? newRec : r))
      }
      return [newRec, ...prev]
    })
  }

  async function handleManualMark(studentCode: string) {
    if (!currentSession) return
    setError(null)
    try {
      const res = await manualRecordAttendance(currentSession.id, studentCode, 'PRESENT')
      if (res.record) {
        handleNewRecord(res.record)
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Không thể điểm danh thủ công')
    }
  }

  // Xuất file CSV / Excel
  function handleExportCsv() {
    if (!currentSession) return
    const curClass = classes.find((c) => c.id === selectedClassId)
    const className = curClass ? `${curClass.classCode} - ${curClass.name}` : 'Lớp học'

    // Kết hợp danh sách thành viên lớp với bản ghi điểm danh
    const rows: ExportRow[] = classMembers.map((student, idx) => {
      const rec = records.find((r) => r.studentCode === student.studentCode)
      if (rec) {
        return {
          index: idx + 1,
          studentCode: student.studentCode,
          fullName: student.fullName,
          status: rec.status === 'PRESENT' ? 'Có mặt' : 'Đi muộn',
          recordedAt: new Date(rec.recordedAt).toLocaleTimeString('vi-VN'),
          cosine: rec.cosine.toFixed(3),
          method: 'Khuôn mặt (Webcam)',
        }
      }
      return {
        index: idx + 1,
        studentCode: student.studentCode,
        fullName: student.fullName,
        status: 'Vắng mặt',
        recordedAt: '-',
        cosine: '-',
        method: '-',
      }
    })

    exportAttendanceToCsv(currentSession.title, className, rows)
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const totalMembers = classMembers.length
  const presentCount = records.length
  const absentCount = Math.max(0, totalMembers - presentCount)

  return (
    <div className="attendance-manager">
      {/* 1. Chọn lớp học */}
      <div className="class-selector-bar">
        <label>
          <strong>Chọn lớp học: </strong>
        </label>
        <select
          value={selectedClassId ?? ''}
          onChange={(e) => setSelectedClassId(Number(e.target.value))}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.classCode} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="notice-error">{error}</div>}
      {message && <div className="notice-success">{message}</div>}

      {/* 2. Mở phiên mới nếu chưa có phiên nào OPEN */}
      {selectedClassId && !sessions.some((s) => s.closedAt === null) && (
        <div className="manager-section">
          <h3>Mở phiên điểm danh mới</h3>
          <form className="inline-form" onSubmit={handleCreateSession}>
            <input
              type="text"
              placeholder="Tiêu đề phiên (VD: Buổi 1 - Giới thiệu)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
            <button type="submit">Mở phiên điểm danh</button>
          </form>
        </div>
      )}

      {/* 3. Khu vực phiên đang chọn */}
      {currentSession && (
        <div className="manager-section">
          <div className="session-header">
            <div>
              <h3>
                {currentSession.title}{' '}
                {currentSession.closedAt === null ? (
                  <span className="badge-open">ĐANG MỞ</span>
                ) : (
                  <span className="badge-closed">ĐÃ ĐÓNG</span>
                )}
              </h3>
              <p className="muted">
                Lớp: <strong>{selectedClass?.classCode}</strong> | Mở lúc:{' '}
                {new Date(currentSession.openedAt).toLocaleTimeString()}{' '}
                {currentSession.closedAt &&
                  ` — Đóng lúc: ${new Date(currentSession.closedAt).toLocaleTimeString()}`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={handleExportCsv}>
                📥 Xuất Excel / CSV
              </button>
              {currentSession.closedAt === null && (
                <button
                  className="btn-danger"
                  onClick={() => handleCloseSession(currentSession.id)}
                >
                  Đóng phiên điểm danh
                </button>
              )}
            </div>
          </div>

          {/* Thẻ thống kê tổng quan phiên */}
          <div className="stats-bar">
            <div className="stat-card">
              <span className="stat-value">{totalMembers}</span>
              <span className="stat-label">Tổng SV lớp</span>
            </div>
            <div className="stat-card stat-success">
              <span className="stat-value">{presentCount}</span>
              <span className="stat-label">Có mặt</span>
            </div>
            <div className="stat-card stat-danger">
              <span className="stat-value">{absentCount}</span>
              <span className="stat-label">Vắng mặt</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {totalMembers > 0 ? ((presentCount / totalMembers) * 100).toFixed(0) : 0}%
              </span>
              <span className="stat-label">Tỷ lệ có mặt</span>
            </div>
          </div>

          {/* Camera chỉ bật khi phiên đang OPEN */}
          {currentSession.closedAt === null ? (
            <AttendanceLiveCamera
              sessionId={currentSession.id}
              onNewRecord={handleNewRecord}
            />
          ) : (
            <p className="muted" style={{ padding: '0.75rem', background: 'var(--color-bg)' }}>
              Phiên điểm danh này đã kết thúc. Bạn có thể xuất file báo cáo ở nút phía trên.
            </p>
          )}

          {/* Bảng danh sách sinh viên lớp & trạng thái điểm danh */}
          <h4>Danh sách sinh viên lớp ({totalMembers})</h4>
          {totalMembers === 0 ? (
            <p className="muted">Lớp này chưa có sinh viên nào. Vui lòng thêm sinh viên vào lớp trước.</p>
          ) : (
            <table className="simple-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã SV</th>
                  <th>Họ và tên</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                  <th>Cosine</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {classMembers.map((m, index) => {
                  const rec = records.find((r) => r.studentCode === m.studentCode)
                  return (
                    <tr key={m.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{m.studentCode}</strong>
                      </td>
                      <td>{m.fullName}</td>
                      <td>
                        {rec ? (
                          <span className={rec.status === 'PRESENT' ? 'tag-present' : 'tag-late'}>
                            {rec.status === 'PRESENT' ? 'Có mặt' : 'Đi muộn'}
                          </span>
                        ) : (
                          <span className="tag-absent">Vắng mặt</span>
                        )}
                      </td>
                      <td>{rec ? new Date(rec.recordedAt).toLocaleTimeString() : '-'}</td>
                      <td>{rec ? rec.cosine.toFixed(3) : '-'}</td>
                      <td>
                        {rec ? (
                          <span className="muted" style={{ fontSize: '0.8rem' }}>
                            Đã điểm danh
                          </span>
                        ) : currentSession.closedAt === null ? (
                          <button
                            className="btn-link-action"
                            onClick={() => handleManualMark(m.studentCode)}
                            title="Điểm danh bù cho sinh viên"
                          >
                            ✓ Có mặt
                          </button>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 4. Lịch sử các phiên cũ */}
      {sessions.length > 1 && (
        <div className="manager-section">
          <h4>Lịch sử các phiên của lớp</h4>
          <div className="session-pills">
            {sessions.map((s) => (
              <button
                key={s.id}
                className={`session-pill ${s.id === currentSession?.id ? 'active' : ''}`}
                onClick={() => setCurrentSession(s)}
              >
                #{s.id} {s.title} ({s.closedAt ? 'Đã đóng' : 'Đang mở'})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
