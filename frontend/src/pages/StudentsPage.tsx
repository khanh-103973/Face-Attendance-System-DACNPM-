/**
 * StudentsPage.tsx — Quản lý Sinh viên (Khớp 100% Mockup 4).
 *
 * Tính năng:
 * - Tìm kiếm theo Mã SV, Họ và tên
 * - Lọc theo Lớp học và Trạng thái khuôn mặt (Đã đăng ký / Chưa đăng ký)
 * - Nút "+ Thêm sinh viên" mở Modal thêm sinh viên mới
 * - Nút Sửa (Icon bút chì) mở Modal chỉnh sửa Họ và tên sinh viên
 * - Nút Camera trên từng dòng mở Modal Đăng ký khuôn mặt 20 ảnh (Mockup 5)
 * - Trạng thái khuôn mặt đồng bộ thời gian thực với AI Gallery qua endpoint /api/students/registered-faces
 */

import { useEffect, useState } from 'react'
import {
  addStudent,
  updateStudent,
  getClasses,
  getClassMembers,
  getStudents,
  getRegisteredFaces,
  isApiError,
  type SchoolClass,
  type Student,
} from '../api'
import FaceRegistrationModal from './FaceRegistrationModal'
import { useAuth } from '../AuthContext'

const PAGE_SIZE = 10

export default function StudentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [studentClassMap, setStudentClassMap] = useState<Record<number, string[]>>({})
  const [registeredFaces, setRegisteredFaces] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // Modal Thêm sinh viên
  const [showAddModal, setShowAddModal] = useState(false)
  const [newStudentCode, setNewStudentCode] = useState('')
  const [newFullName, setNewFullName] = useState('')

  // Modal Chỉnh sửa sinh viên
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Modal Đăng ký khuôn mặt (Mockup 5)
  const [selectedStudentForFace, setSelectedStudentForFace] = useState<Student | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadAllStudents(): Promise<Student[]> {
    const all: Student[] = []
    let page = 0
    const batchSize = 100
    while (true) {
      const res = await getStudents(page, batchSize)
      all.push(...res.items)
      if (all.length >= res.totalElements || res.items.length === 0) break
      page++
    }
    return all
  }

  async function loadAllClasses(): Promise<SchoolClass[]> {
    const all: SchoolClass[] = []
    let page = 0
    const batchSize = 100
    while (true) {
      const res = await getClasses(page, batchSize)
      all.push(...res.items)
      if (all.length >= res.totalElements || res.items.length === 0) break
      page++
    }
    return all
  }

  async function loadData() {
    try {
      const [allStudents, allClasses, faces] = await Promise.all([
        loadAllStudents(),
        loadAllClasses(),
        getRegisteredFaces().catch(() => [] as string[]),
      ])
      setStudents(allStudents)
      setClasses(allClasses)
      setRegisteredFaces(faces || [])

      const classMap: Record<number, string[]> = {}
      await Promise.all(
        allClasses.map(async (cls) => {
          try {
            let mPage = 0
            while (true) {
              const mRes = await getClassMembers(cls.id, mPage, 100)
              for (const m of mRes.items) {
                if (!classMap[m.id]) classMap[m.id] = []
                if (!classMap[m.id].includes(cls.classCode)) {
                  classMap[m.id].push(cls.classCode)
                }
              }
              if ((mPage + 1) * 100 >= mRes.totalElements || mRes.items.length === 0) break
              mPage++
            }
          } catch {
            // bỏ qua lỗi từng lớp
          }
        }),
      )
      setStudentClassMap(classMap)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi tải danh sách sinh viên')
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!newStudentCode.trim() || !newFullName.trim()) return
    setErrorMsg(null)
    try {
      await addStudent(newStudentCode.trim().toUpperCase(), newFullName.trim())
      setNewStudentCode('')
      setNewFullName('')
      setShowAddModal(false)
      setSuccessMsg('Thêm sinh viên thành công!')
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể thêm sinh viên')
    }
  }

  async function handleUpdateStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!editingStudent || !editFullName.trim()) return
    setErrorMsg(null)
    setIsUpdating(true)
    try {
      await updateStudent(editingStudent.id, editFullName.trim())
      setSuccessMsg(`Cập nhật thông tin sinh viên ${editingStudent.studentCode} thành công!`)
      setEditingStudent(null)
      loadData()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể cập nhật thông tin sinh viên')
    } finally {
      setIsUpdating(false)
    }
  }

  // Lọc sinh viên theo tìm kiếm, lớp và trạng thái
  const filteredStudents = students.filter((s) => {
    const matchSearch =
      s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchSearch) return false

    if (selectedClassFilter !== 'ALL') {
      const studentClasses = studentClassMap[s.id] || []
      if (!studentClasses.includes(selectedClassFilter)) return false
    }

    const hasFace = registeredFaces.includes(s.studentCode)
    if (statusFilter === 'REGISTERED') return hasFace
    if (statusFilter === 'NOT_REGISTERED') return !hasFace
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + PAGE_SIZE)

  // Danh sách số trang hiển thị
  function getPageNumbers(): (number | 'dots')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages: (number | 'dots')[] = [1]
    if (safePage > 3) pages.push('dots')
    const start = Math.max(2, safePage - 1)
    const end = Math.min(totalPages - 1, safePage + 1)
    for (let p = start; p <= end; p++) pages.push(p)
    if (safePage < totalPages - 2) pages.push('dots')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="management-page-container">
      {/* Thông báo nổi */}
      {errorMsg && <div className="floating-toast toast-error">{errorMsg}</div>}
      {successMsg && <div className="floating-toast toast-success">{successMsg}</div>}

      {/* 1. Thanh công cụ tìm kiếm và bộ lọc */}
      <div className="table-filter-toolbar">
        <div className="search-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo mã SV, họ tên..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>

        <div className="filter-dropdowns">
          <select
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="filter-select"
          >
            <option value="ALL">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.classCode}>
                {c.classCode}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="filter-select"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="REGISTERED">Đã đăng ký khuôn mặt</option>
            <option value="NOT_REGISTERED">Chưa đăng ký</option>
          </select>
        </div>

        {isAdmin && (
          <button className="primary-action-btn" onClick={() => setShowAddModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Thêm sinh viên</span>
          </button>
        )}
      </div>

      {/* 2. Bảng Danh sách sinh viên */}
      <div className="standard-table-card">
        <table className="standard-data-table">
          <thead>
            <tr>
              <th style={{ width: '45px' }}>#</th>
              <th style={{ width: '120px' }}>Mã SV</th>
              <th>Họ và tên</th>
              <th style={{ width: '130px' }}>Lớp</th>
              <th style={{ width: '110px' }}>Khuôn mặt</th>
              <th style={{ width: '150px' }}>Trạng thái</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.length > 0 ? (
              paginatedStudents.map((student, idx) => {
                const hasFace = registeredFaces.includes(student.studentCode)
                const enrolledClasses = studentClassMap[student.id] || []
                return (
                  <tr key={student.id || idx}>
                    <td>{startIndex + idx + 1}</td>
                    <td>
                      <strong className="code-badge-text">{student.studentCode}</strong>
                    </td>
                    <td className="bold-name-cell">{student.fullName}</td>
                    <td>
                      {enrolledClasses.length > 0 ? (
                        <span className="class-pill-tag">{enrolledClasses.join(', ')}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Chưa phân lớp</span>
                      )}
                    </td>
                    <td>
                      {hasFace ? (
                        <span className="circle-check-icon" title="Đã có dữ liệu khuôn mặt">
                          ✓
                        </span>
                      ) : (
                        <span className="circle-dash-icon" title="Chưa có dữ liệu khuôn mặt">
                          -
                        </span>
                      )}
                    </td>
                    <td>
                      {hasFace ? (
                        <span className="status-badge-green">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Đã đăng ký
                        </span>
                      ) : (
                        <span className="status-badge-gray">Chưa đăng ký</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isAdmin ? (
                        <div className="table-actions-cell">
                          {/* Nút camera đăng ký khuôn mặt */}
                          <button
                            className="table-action-icon-btn blue-action"
                            title={hasFace ? 'Cập nhật / Chụp lại khuôn mặt' : 'Đăng ký khuôn mặt'}
                            onClick={() => setSelectedStudentForFace(student)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </button>

                          {/* Nút sửa */}
                          <button
                            className="table-action-icon-btn"
                            title="Chỉnh sửa thông tin sinh viên"
                            onClick={() => {
                              setEditingStudent(student)
                              setEditFullName(student.fullName)
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Chỉ xem</span>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  Không tìm thấy sinh viên nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Thanh phân trang */}
        <div className="table-pagination-footer">
          <span className="pagination-info">
            Hiển thị {filteredStudents.length === 0 ? 0 : startIndex + 1}–
            {Math.min(startIndex + PAGE_SIZE, filteredStudents.length)} / {filteredStudents.length} sinh viên
            {filteredStudents.length !== students.length ? ` (lọc từ ${students.length} SV)` : ''}
          </span>
          <div className="pagination-pages">
            <button
              className="page-btn"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Trang trước"
            >
              &lt;
            </button>
            {getPageNumbers().map((item, i) =>
              item === 'dots' ? (
                <span key={`dots-${i}`} className="page-dots">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  className={`page-btn ${item === safePage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              className="page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Trang tiếp"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Modal Thêm sinh viên */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddStudent}>
              <div className="modal-header">
                <h3>Thêm sinh viên mới vào hệ thống</h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div>
                  <label><strong>Mã sinh viên:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: SV006"
                    value={newStudentCode}
                    onChange={(e) => setNewStudentCode(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label><strong>Họ và tên:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: Hoàng Văn Thắng"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Lưu sinh viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh sửa sinh viên */}
      {editingStudent && (
        <div className="modal-backdrop" onClick={() => setEditingStudent(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleUpdateStudent}>
              <div className="modal-header">
                <h3>Chỉnh sửa thông tin sinh viên</h3>
                <button type="button" className="modal-close-btn" onClick={() => setEditingStudent(null)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div>
                  <label><strong>Mã sinh viên:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    value={editingStudent.studentCode}
                    disabled
                    style={{ background: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }}
                  />
                  <small style={{ color: '#9ca3af', display: 'block', marginTop: '4px', fontSize: '12px' }}>
                    Mã sinh viên là định danh cố định gắn với dữ liệu khuôn mặt.
                  </small>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label><strong>Họ và tên sinh viên:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: Trương Văn Trường"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingStudent(null)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={isUpdating}>
                  {isUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đăng ký khuôn mặt sinh viên (Mockup 5) */}
      {selectedStudentForFace && (
        <FaceRegistrationModal
          student={selectedStudentForFace}
          onClose={() => setSelectedStudentForFace(null)}
          onSuccess={() => {
            setSelectedStudentForFace(null)
            setSuccessMsg(`Đã đăng ký 20 ảnh khuôn mặt cho ${selectedStudentForFace.fullName} (${selectedStudentForFace.studentCode}) thành công!`)
            loadData()
            setTimeout(() => setSuccessMsg(null), 3000)
          }}
        />
      )}
    </div>
  )
}
