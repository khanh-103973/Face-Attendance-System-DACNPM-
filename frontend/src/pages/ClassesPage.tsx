/**
 * ClassesPage.tsx — Quản lý Lớp học (Khớp 100% Mockup 6).
 *
 * Tính năng:
 * - Danh sách lớp học: Mã lớp, Tên môn học, Sĩ số, Giảng viên phụ trách
 * - Tìm kiếm theo tên lớp, môn học
 * - Nút "+ Tạo lớp học" mở Modal tạo lớp mới
 * - Nút xem thành viên lớp học & gán sinh viên vào lớp
 */

import { useEffect, useState } from 'react'
import {
  addClass,
  updateClass,
  enrollStudent,
  getClasses,
  getClassMembers,
  getStudents,
  isApiError,
  unenrollStudent,
  type SchoolClass,
  type Student,
} from '../api'

export default function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<number, number>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Tạo lớp học
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassCode, setNewClassCode] = useState('')
  const [newClassName, setNewClassName] = useState('')

  // Modal Sửa tên môn học
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null)
  const [editClassName, setEditClassName] = useState('')

  // Modal Xem & Quản lý thành viên lớp
  const [selectedClassForMembers, setSelectedClassForMembers] = useState<SchoolClass | null>(null)
  const [members, setMembers] = useState<Student[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [selectedStudentToEnroll, setSelectedStudentToEnroll] = useState<number | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadClasses()
    loadAllStudents()
  }, [])

  async function loadAllStudents() {
    try {
      const all: Student[] = []
      let page = 0
      while (true) {
        const res = await getStudents(page, 100)
        all.push(...res.items)
        if (all.length >= res.totalElements || res.items.length === 0) break
        page++
      }
      setAllStudents(all)
    } catch {
      // bỏ qua
    }
  }

  async function loadClasses() {
    try {
      const res = await getClasses(0, 100)
      setClasses(res.items)
      const counts: Record<number, number> = {}
      await Promise.all(
        res.items.map(async (c) => {
          try {
            const m = await getClassMembers(c.id, 0, 1)
            counts[c.id] = m.totalElements
          } catch {
            counts[c.id] = 0
          }
        }),
      )
      setMemberCounts(counts)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi tải danh sách lớp học')
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault()
    if (!editingClass || !editClassName.trim()) return
    setErrorMsg(null)
    try {
      await updateClass(editingClass.id, editClassName.trim())
      setEditingClass(null)
      setSuccessMsg('Cập nhật tên môn học thành công!')
      loadClasses()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể cập nhật lớp học')
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault()
    if (!newClassCode.trim() || !newClassName.trim()) return
    setErrorMsg(null)
    try {
      await addClass(newClassCode.trim().toUpperCase(), newClassName.trim())
      setNewClassCode('')
      setNewClassName('')
      setShowCreateModal(false)
      setSuccessMsg('Tạo lớp học mới thành công!')
      loadClasses()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể tạo lớp học')
    }
  }

  async function handleOpenMembers(c: SchoolClass) {
    setSelectedClassForMembers(c)
    try {
      const res = await getClassMembers(c.id)
      setMembers(res.items)
    } catch {
      setMembers([])
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClassForMembers || !selectedStudentToEnroll) return
    try {
      await enrollStudent(selectedClassForMembers.id, selectedStudentToEnroll)
      const res = await getClassMembers(selectedClassForMembers.id)
      setMembers(res.items)
      setMemberCounts((prev) => ({ ...prev, [selectedClassForMembers.id]: res.totalElements }))
      setSelectedStudentToEnroll(null)
      setSuccessMsg('Đã thêm sinh viên vào lớp!')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi khi thêm sinh viên')
    }
  }

  async function handleUnenroll(studentId: number) {
    if (!selectedClassForMembers) return
    try {
      await unenrollStudent(selectedClassForMembers.id, studentId)
      const res = await getClassMembers(selectedClassForMembers.id)
      setMembers(res.items)
      setMemberCounts((prev) => ({ ...prev, [selectedClassForMembers.id]: res.totalElements }))
      setSuccessMsg('Đã xóa sinh viên khỏi lớp!')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi khi xóa sinh viên khỏi lớp')
    }
  }

  const displayClasses = classes.map((c) => ({
    ...c,
    count: memberCounts[c.id] ?? 0,
  }))

  const filteredClasses = displayClasses.filter(
    (c) =>
      c.classCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="management-page-container">
      {errorMsg && <div className="floating-toast toast-error">{errorMsg}</div>}
      {successMsg && <div className="floating-toast toast-success">{successMsg}</div>}

      {/* 1. Thanh tìm kiếm & nút tạo lớp */}
      <div className="table-filter-toolbar">
        <div className="search-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Tìm tên lớp, môn học..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="primary-action-btn" onClick={() => setShowCreateModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Tạo lớp học</span>
        </button>
      </div>

      {/* 2. Bảng Danh sách lớp học */}
      <div className="standard-table-card">
        <table className="standard-data-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>#</th>
              <th style={{ width: '130px' }}>Mã lớp</th>
              <th>Tên môn học</th>
              <th style={{ width: '100px' }}>Sĩ số</th>
              <th style={{ width: '180px' }}>Giảng viên</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredClasses.map((cls, idx) => (
              <tr key={cls.id || idx}>
                <td>{idx + 1}</td>
                <td>
                  <strong className="code-badge-text">{cls.classCode}</strong>
                </td>
                <td className="bold-name-cell">{cls.name}</td>
                <td>
                  <span className="count-pill">{cls.count}</span>
                </td>
                <td>Giảng viên phụ trách</td>
                <td style={{ textAlign: 'center' }}>
                  <div className="table-actions-cell">
                    {/* Nút xem danh sách sinh viên */}
                    <button
                      className="table-action-icon-btn blue-action"
                      title="Xem danh sách sinh viên lớp"
                      onClick={() => handleOpenMembers(cls)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                    </button>
                    {/* Nút chỉnh sửa */}
                    <button
                      className="table-action-icon-btn"
                      title="Chỉnh sửa tên môn học"
                      onClick={() => {
                        setEditingClass(cls)
                        setEditClassName(cls.name)
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Phân trang */}
        <div className="table-pagination-footer">
          <span className="pagination-info">
            Hiển thị {filteredClasses.length} / {displayClasses.length}
          </span>
          <div className="pagination-pages">
            <button className="page-btn active">1</button>
          </div>
        </div>
      </div>

      {/* Modal 1: Tạo lớp học mới */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateClass}>
              <div className="modal-header">
                <h3>Tạo lớp học mới</h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div>
                  <label><strong>Mã lớp học:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: ST23D"
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label><strong>Tên môn học:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: Học sâu (Deep Learning)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sửa tên môn học */}
      {editingClass && (
        <div className="modal-backdrop" onClick={() => setEditingClass(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleUpdateClass}>
              <div className="modal-header">
                <h3>Chỉnh sửa lớp {editingClass.classCode}</h3>
                <button type="button" className="modal-close-btn" onClick={() => setEditingClass(null)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div>
                  <label><strong>Mã lớp học:</strong></label>
                  <input type="text" className="full-width-input" value={editingClass.classCode} disabled />
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label><strong>Tên môn học:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingClass(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Quản lý thành viên lớp học */}
      {selectedClassForMembers && (
        <div className="modal-backdrop" onClick={() => setSelectedClassForMembers(null)}>
          <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                Thành viên lớp {selectedClassForMembers.classCode} ({members.length})
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedClassForMembers(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Form thêm nhanh sinh viên vào lớp */}
              <form onSubmit={handleEnroll} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <select
                  className="full-width-select"
                  value={selectedStudentToEnroll ?? ''}
                  onChange={(e) => setSelectedStudentToEnroll(Number(e.target.value))}
                  required
                >
                  <option value="">-- Chọn sinh viên để thêm vào lớp --</option>
                  {allStudents
                    .filter((s) => !members.some((m) => m.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.studentCode} — {s.fullName}
                      </option>
                    ))}
                </select>
                <button type="submit" className="btn-primary" disabled={!selectedStudentToEnroll}>
                  + Thêm
                </button>
              </form>

              {/* Danh sách thành viên hiện tại */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="standard-data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mã SV</th>
                      <th>Họ và tên</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m, idx) => (
                      <tr key={m.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{m.studentCode}</strong></td>
                        <td>{m.fullName}</td>
                        <td>
                          <button
                            className="table-action-icon-btn red-action"
                            title="Xóa khỏi lớp"
                            onClick={() => handleUnenroll(m.id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedClassForMembers(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
