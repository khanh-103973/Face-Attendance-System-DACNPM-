/**
 * AdminPage.tsx — Quản trị Hệ thống (Khớp 100% Mockup 9).
 *
 * Tính năng:
 * - Tab chính: Người dùng, Vai trò & Phân quyền, Cài đặt chung, Nhật ký hoạt động
 * - Danh sách người dùng: Tên đăng nhập, Họ và tên, Vai trò (Admin, Giảng viên), Trạng thái
 * - Nút "+ Thêm người dùng" mở Modal tạo tài khoản Giảng viên mới (mật khẩu mã hóa BCrypt)
 * - Tự động chuẩn hóa tên đăng nhập không dấu (VD: 'Tạ Quốc Ý' -> 'taquocy')
 */

import { useEffect, useState } from 'react'
import { createTeacher, getTeachers, isApiError, type TeacherAccount } from '../api'

function normalizeToUsername(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
}

export default function AdminPage() {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([])
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles' | 'settings' | 'audit'>('users')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal Tạo người dùng mới
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadTeachers()
  }, [])

  async function loadTeachers() {
    try {
      const data = await getTeachers()
      setTeachers(data)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi tải danh sách người dùng')
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername.trim() || !newPassword.trim()) return
    setErrorMsg(null)
    try {
      await createTeacher(newUsername.trim(), newPassword)
      setShowCreateModal(false)
      setNewFullName('')
      setNewUsername('')
      setNewPassword('')
      setSuccessMsg(`Đã tạo tài khoản giảng viên '${newUsername}' thành công!`)
      loadTeachers()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể tạo tài khoản')
    }
  }

  // Danh sách hiển thị kết hợp admin và giảng viên thật từ CSDL
  const displayUsers = [
    { id: 1, username: 'admin', fullName: 'Quản trị viên', role: 'Admin', enabled: true },
    ...teachers.map((t, idx) => ({
      id: t.id || idx + 2,
      username: t.username,
      fullName: t.username === 'taquocy' ? 'Tạ Quốc Ý' : `GV. ${t.username}`,
      role: 'Giảng viên',
      enabled: t.enabled,
    })),
  ]

  const filteredUsers = displayUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="management-page-container">
      {errorMsg && <div className="floating-toast toast-error">{errorMsg}</div>}
      {successMsg && <div className="floating-toast toast-success">{successMsg}</div>}

      {/* 1. Sub-tabs trên đầu trang */}
      <div className="admin-subtabs-nav">
        <button
          className={`subtab-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('users')}
        >
          Người dùng
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('roles')}
        >
          Vai trò &amp; Phân quyền
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('settings')}
        >
          Cài đặt chung
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('audit')}
        >
          Nhật ký hoạt động
        </button>
      </div>

      {activeSubTab === 'users' && (
        <>
          {/* 2. Thanh lọc & nút thêm người dùng */}
          <div className="table-filter-toolbar">
            <div className="search-input-wrapper">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Tìm người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button className="primary-action-btn" onClick={() => setShowCreateModal(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Thêm người dùng</span>
            </button>
          </div>

          {/* 3. Bảng Người dùng */}
          <div className="standard-table-card">
            <table className="standard-data-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th style={{ width: '150px' }}>Tên đăng nhập</th>
                  <th>Họ và tên</th>
                  <th style={{ width: '140px' }}>Vai trò</th>
                  <th style={{ width: '140px' }}>Trạng thái</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr key={user.id}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong className="code-badge-text">{user.username}</strong>
                    </td>
                    <td className="bold-name-cell">{user.fullName}</td>
                    <td>
                      <span className={user.role === 'Admin' ? 'role-pill-admin' : 'role-pill-teacher'}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      {user.enabled ? (
                        <span className="status-badge-green">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Hoạt động
                        </span>
                      ) : (
                        <span className="status-badge-red">Khóa</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-actions-cell">
                        <button className="table-action-icon-btn" title="Chỉnh sửa">
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
          </div>
        </>
      )}

      {activeSubTab === 'roles' && (
        <div className="standard-table-card placeholder-subtab-box">
          <h3>Phân quyền hệ thống (RBAC)</h3>
          <p>Hệ thống có 2 nhóm quyền cố định: <strong>ADMIN</strong> (Toàn quyền quản trị) và <strong>TEACHER</strong> (Giảng viên mở ca và điểm danh).</p>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <div className="standard-table-card placeholder-subtab-box">
          <h3>Cài đặt chung</h3>
          <p>Cấu hình cổng Backend (8080), AI ArcFace (8000), Ngưỡng nhận diện Cosine (0.50).</p>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="standard-table-card placeholder-subtab-box">
          <h3>Nhật ký hoạt động</h3>
          <p>Lịch sử các phiên điểm danh và thao tác sửa đổi hồ sơ được lưu vết trong cơ sở dữ liệu.</p>
        </div>
      )}

      {/* Modal Thêm người dùng */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateUser}>
              <div className="modal-header">
                <h3>Thêm tài khoản Giảng viên mới</h3>
                <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)}>
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div>
                  <label><strong>Họ và tên Giảng viên:</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: Tạ Quốc Ý"
                    value={newFullName}
                    onChange={(e) => {
                      setNewFullName(e.target.value)
                      setNewUsername(normalizeToUsername(e.target.value))
                    }}
                    required
                  />
                </div>
                <div>
                  <label><strong>Tên đăng nhập (viết liền không dấu):</strong></label>
                  <input
                    type="text"
                    className="full-width-input"
                    placeholder="VD: taquocy"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                    required
                  />
                </div>
                <div>
                  <label><strong>Mật khẩu ban đầu:</strong></label>
                  <input
                    type="password"
                    className="full-width-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
