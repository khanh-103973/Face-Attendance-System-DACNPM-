/**
 * TeacherManager.tsx — Quản lý tài khoản Giảng viên (chỉ dành cho Quản trị viên).
 */

import { type FormEvent, useEffect, useState } from 'react'
import {
  createTeacher,
  getTeachers,
  isApiError,
  type TeacherAccount,
} from '../api'

export default function TeacherManager() {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function normalizeToUsername(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
  }

  const generatedUsername = normalizeToUsername(username)

  useEffect(() => {
    loadTeachers()
  }, [])

  async function loadTeachers() {
    setLoading(true)
    setError(null)
    try {
      const data = await getTeachers()
      setTeachers(data)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Lỗi tải danh sách giảng viên')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTeacher(e: FormEvent) {
    e.preventDefault()
    const finalUser = normalizeToUsername(username)
    if (!finalUser || finalUser.length < 3) {
      setError('Tên đăng nhập sau khi chuẩn hoá cần có ít nhất 3 ký tự (chữ hoặc số)')
      return
    }
    if (!password || password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự')
      return
    }
    setError(null)
    setMessage(null)
    try {
      await createTeacher(finalUser, password)
      setUsername('')
      setPassword('')
      setMessage(`Tạo tài khoản Giảng viên "${finalUser}" thành công!`)
      loadTeachers()
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 409) {
          setError(`Tên đăng nhập "${finalUser}" đã tồn tại!`)
        } else {
          setError(err.message)
        }
      } else {
        setError('Không thể tạo tài khoản')
      }
    }
  }

  return (
    <div className="school-manager">
      {error && <div className="notice-error">{error}</div>}
      {message && <div className="notice-success">{message}</div>}

      {/* Form tạo tài khoản Giảng viên */}
      <section className="manager-section">
        <h3>Tạo tài khoản Giảng viên mới</h3>
        <p className="muted" style={{ marginBottom: '0.5rem' }}>
          Tài khoản này dùng để đăng nhập vào hệ thống để mở phiên điểm danh và xem danh sách lớp.
        </p>
        <form className="inline-form" onSubmit={handleCreateTeacher}>
          <input
            type="text"
            placeholder="Họ tên hoặc Tên đăng nhập (VD: Tạ Quốc Ý hoặc taquocy)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mật khẩu (tối thiểu 6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit">+ Tạo tài khoản</button>
        </form>
        {username.trim() && (
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Tên đăng nhập hệ thống sẽ tạo:{' '}
            <strong style={{ color: 'var(--color-primary)' }}>
              {generatedUsername || '(không hợp lệ)'}
            </strong>
          </p>
        )}
      </section>

      {/* Danh sách tài khoản Giảng viên */}
      <section className="manager-section">
        <h3>Danh sách tài khoản Giảng viên ({teachers.length})</h3>
        {loading ? (
          <p className="muted">Đang tải...</p>
        ) : teachers.length === 0 ? (
          <p className="muted">Chưa có tài khoản giảng viên nào trong hệ thống.</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên đăng nhập</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>
                    <strong>{t.username}</strong>
                  </td>
                  <td>
                    <span className="role-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                      GIẢNG VIÊN
                    </span>
                  </td>
                  <td>
                    <span style={{ color: t.enabled ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                      {t.enabled ? 'Đang hoạt động' : 'Bị khóa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
