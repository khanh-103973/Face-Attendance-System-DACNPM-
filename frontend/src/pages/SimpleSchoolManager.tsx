/**
 * SimpleSchoolManager.tsx — Quản lý Lớp học, Sinh viên và Thành viên của lớp.
 */

import { type FormEvent, useEffect, useState } from 'react'
import {
  addClass,
  addStudent,
  enrollStudent,
  getClasses,
  getClassMembers,
  getStudents,
  isApiError,
  type SchoolClass,
  type Student,
  unenrollStudent,
} from '../api'
import { useAuth } from '../AuthContext'
import FaceRegistrationModal from './FaceRegistrationModal'

export default function SimpleSchoolManager() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'classes' | 'students'>('classes')

  // Classes state
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [newClassCode, setNewClassCode] = useState('')
  const [newClassName, setNewClassName] = useState('')

  // Selected Class & Members
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null)
  const [members, setMembers] = useState<Student[]>([])
  const [studentToEnroll, setStudentToEnroll] = useState<number | ''>('')

  // Students state
  const [students, setStudents] = useState<Student[]>([])
  const [newStudentCode, setNewStudentCode] = useState('')
  const [newStudentName, setNewStudentName] = useState('')

  // Modal đăng ký khuôn mặt
  const [registeringStudent, setRegisteringStudent] = useState<Student | null>(null)

  // Common UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [tab])

  useEffect(() => {
    if (selectedClass) {
      loadMembers(selectedClass.id)
    } else {
      setMembers([])
    }
  }, [selectedClass])

  async function loadData() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const [cRes, sRes] = await Promise.all([getClasses(), getStudents()])
      setClasses(cRes.items)
      setStudents(sRes.items)
      if (cRes.items.length > 0 && !selectedClass) {
        setSelectedClass(cRes.items[0])
      }
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers(classId: number) {
    try {
      const res = await getClassMembers(classId)
      setMembers(res.items)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Lỗi tải thành viên lớp')
    }
  }

  async function handleCreateClass(e: FormEvent) {
    e.preventDefault()
    if (!newClassCode.trim() || !newClassName.trim()) return
    setError(null)
    setMessage(null)
    try {
      const created = await addClass(newClassCode.trim(), newClassName.trim())
      setNewClassCode('')
      setNewClassName('')
      setMessage('Thêm lớp học thành công!')
      setSelectedClass(created)
      loadData()
    } catch (err) {
      setError(isApiError(err) ? `Lỗi: ${err.message}` : 'Không thể thêm lớp')
    }
  }

  async function handleCreateStudent(e: FormEvent) {
    e.preventDefault()
    if (!newStudentCode.trim() || !newStudentName.trim()) return
    setError(null)
    setMessage(null)
    try {
      await addStudent(newStudentCode.trim(), newStudentName.trim())
      setNewStudentCode('')
      setNewStudentName('')
      setMessage('Thêm sinh viên thành công!')
      loadData()
    } catch (err) {
      setError(isApiError(err) ? `Lỗi: ${err.message}` : 'Không thể thêm sinh viên')
    }
  }

  async function handleEnroll(e: FormEvent) {
    e.preventDefault()
    if (!selectedClass || studentToEnroll === '') return
    setError(null)
    setMessage(null)
    try {
      await enrollStudent(selectedClass.id, Number(studentToEnroll))
      setStudentToEnroll('')
      setMessage('Đã thêm sinh viên vào lớp!')
      loadMembers(selectedClass.id)
    } catch (err) {
      setError(isApiError(err) ? `Lỗi: ${err.message}` : 'Không thể gán vào lớp')
    }
  }

  async function handleUnenroll(studentId: number) {
    if (!selectedClass) return
    setError(null)
    setMessage(null)
    try {
      await unenrollStudent(selectedClass.id, studentId)
      setMessage('Đã xóa sinh viên khỏi lớp!')
      loadMembers(selectedClass.id)
    } catch (err) {
      setError(isApiError(err) ? `Lỗi: ${err.message}` : 'Không thể xóa khỏi lớp')
    }
  }

  // Danh sách sinh viên chưa có trong lớp để hiển thị trong select
  const availableStudentsToEnroll = students.filter(
    (s) => !members.some((m) => m.id === s.id),
  )

  return (
    <div className="school-manager">
      <div className="tab-buttons">
        <button
          className={`tab-btn ${tab === 'classes' ? 'active' : ''}`}
          onClick={() => setTab('classes')}
        >
          Lớp học & Thành viên ({classes.length})
        </button>
        <button
          className={`tab-btn ${tab === 'students' ? 'active' : ''}`}
          onClick={() => setTab('students')}
        >
          Danh sách Sinh viên ({students.length})
        </button>
      </div>

      {error && <div className="notice-error">{error}</div>}
      {message && <div className="notice-success">{message}</div>}

      {/* Tab Quản lý Lớp học & Thành viên */}
      {tab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Thêm lớp mới */}
          <section className="manager-section">
            <h3>Thêm lớp học mới</h3>
            <form className="inline-form" onSubmit={handleCreateClass}>
              <input
                type="text"
                placeholder="Mã lớp (VD: ST23D)"
                value={newClassCode}
                onChange={(e) => setNewClassCode(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Tên lớp (VD: Lớp Công nghệ phần mềm D)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                required
              />
              <button type="submit">Thêm lớp</button>
            </form>
          </section>

          {/* Chọn lớp và Quản lý danh sách thành viên */}
          <section className="manager-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <label>
                <strong>Xem thành viên lớp:</strong>
              </label>
              <select
                style={{ padding: '0.4rem 0.75rem', fontSize: '1rem', borderRadius: 'var(--radius)' }}
                value={selectedClass?.id ?? ''}
                onChange={(e) => {
                  const c = classes.find((item) => item.id === Number(e.target.value))
                  setSelectedClass(c ?? null)
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.classCode} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedClass && (
              <>
                {/* Form thêm sinh viên vào lớp này */}
                <form className="inline-form" onSubmit={handleEnroll} style={{ marginTop: '1rem' }}>
                  <select
                    style={{ flex: 1, minWidth: '200px', padding: '0.5rem', borderRadius: 'var(--radius)' }}
                    value={studentToEnroll}
                    onChange={(e) => setStudentToEnroll(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Chọn sinh viên để thêm vào lớp --</option>
                    {availableStudentsToEnroll.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.studentCode} — {s.fullName}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={studentToEnroll === ''}>
                    + Thêm vào lớp
                  </button>
                </form>

                <h4>
                  Danh sách sinh viên trong lớp {selectedClass.classCode} ({members.length})
                </h4>
                {members.length === 0 ? (
                  <p className="muted">Lớp này hiện chưa có sinh viên nào.</p>
                ) : (
                  <table className="simple-table">
                    <thead>
                      <tr>
                        <th>Mã SV</th>
                        <th>Họ và tên</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.studentCode}</strong>
                          </td>
                          <td>{m.fullName}</td>
                          <td>
                            <button
                              className="btn-link-danger"
                              onClick={() => handleUnenroll(m.id)}
                            >
                              Xóa khỏi lớp
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* Tab Quản lý Danh sách Sinh viên */}
      {tab === 'students' && (
        <section className="manager-section">
          {user?.role === 'ADMIN' ? (
            <>
              <h3>Thêm sinh viên mới vào hệ thống</h3>
              <form className="inline-form" onSubmit={handleCreateStudent}>
                <input
                  type="text"
                  placeholder="Mã sinh viên (VD: SV002)"
                  value={newStudentCode}
                  onChange={(e) => setNewStudentCode(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Họ và tên (VD: Trần Thị Mai)"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  required
                />
                <button type="submit">Thêm sinh viên</button>
              </form>
            </>
          ) : (
            <p className="muted" style={{ padding: '0.5rem 0' }}>
              Danh mục sinh viên toàn trường do Quản trị viên quản lý. Giảng viên có thể xem và chọn sinh viên để gán vào lớp học của mình ở tab <strong>Lớp học & Thành viên</strong>.
            </p>
          )}

          <h3>Toàn bộ sinh viên trong hệ thống ({students.length})</h3>
          {loading ? (
            <p className="muted">Đang tải...</p>
          ) : students.length === 0 ? (
            <p className="muted">Chưa có sinh viên nào.</p>
          ) : (
            <table className="simple-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mã SV</th>
                  <th>Họ và tên</th>
                  {user?.role === 'ADMIN' && <th>Khuôn mặt</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>
                      <strong>{s.studentCode}</strong>
                    </td>
                    <td>{s.fullName}</td>
                    {user?.role === 'ADMIN' && (
                      <td>
                        <button
                          className="btn-link-action"
                          onClick={() => setRegisteringStudent(s)}
                        >
                          📸 Đăng ký mặt
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Modal đăng ký khuôn mặt */}
      {registeringStudent && (
        <FaceRegistrationModal
          student={registeringStudent}
          onClose={() => setRegisteringStudent(null)}
          onSuccess={() => {
            setRegisteringStudent(null)
            setMessage(`Đăng ký khuôn mặt cho ${registeringStudent.studentCode} thành công!`)
          }}
        />
      )}
    </div>
  )
}
