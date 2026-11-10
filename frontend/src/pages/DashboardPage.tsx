/**
 * DashboardPage.tsx — Khung sườn ứng dụng chính với Layout Sidebar + TopHeader.
 *
 * Tích hợp toàn bộ 9 màn hình theo thiết kế hệ thống hoàn chỉnh:
 * - 'home' -> HomePage (Mockup 2)
 * - 'attendance' -> AttendanceDashboard (Mockup 3)
 * - 'students' -> StudentsPage (Mockup 4, 5)
 * - 'classes' -> ClassesPage (Mockup 6)
 * - 'sessions' -> SessionsPage (Mockup 7)
 * - 'reports' -> ReportsPage (Mockup 8)
 * - 'admin' -> AdminPage (Mockup 9)
 */

import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import Sidebar, { type NavTab } from '../components/Sidebar'
import TopHeader from '../components/TopHeader'
import AdminPage from './AdminPage'
import AttendanceDashboard from './AttendanceDashboard'
import ClassesPage from './ClassesPage'
import HomePage from './HomePage'
import ReportsPage from './ReportsPage'
import SessionsPage from './SessionsPage'
import StudentsPage from './StudentsPage'

const TAB_METAS: Record<NavTab, { title: string; breadcrumb: string }> = {
  home: { title: 'Trang chủ', breadcrumb: 'Trang chủ' },
  attendance: { title: 'Điểm danh lớp học', breadcrumb: 'Trang chủ > Điểm danh' },
  students: { title: 'Quản lý sinh viên', breadcrumb: 'Trang chủ > Sinh viên' },
  classes: { title: 'Quản lý lớp học', breadcrumb: 'Trang chủ > Lớp học' },
  sessions: { title: 'Quản lý buổi học', breadcrumb: 'Trang chủ > Buổi học' },
  reports: { title: 'Thống kê & Báo cáo', breadcrumb: 'Trang chủ > Thống kê & Báo cáo' },
  admin: { title: 'Quản trị hệ thống', breadcrumb: 'Trang chủ > Quản trị hệ thống' },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const tabKey = `dashboard-tab:${user!.username}`
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem(tabKey)
      return saved && Object.hasOwn(TAB_METAS, saved) ? saved as NavTab : 'home'
    } catch {
      return 'home'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(tabKey, activeTab)
    } catch {
      // Keep navigation available when storage is disabled.
    }
  }, [activeTab, tabKey])

  const currentMeta = TAB_METAS[activeTab] || TAB_METAS.home

  return (
    <div className="app-layout-container">
      {/* 1. Sidebar bên trái (Dark Navy Theme) */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* 2. Khối nội dung chính bên phải */}
      <div className="app-main-viewport">
        {/* Top Header */}
        <TopHeader title={currentMeta.title} breadcrumb={currentMeta.breadcrumb} />

        {/* Nội dung trang theo từng Tab */}
        <main className="app-content-body">
          {activeTab === 'home' && (
            <HomePage
              onNavigateAttendance={() => setActiveTab('attendance')}
              onNavigateClasses={() => setActiveTab('classes')}
              onNavigateStudents={() => setActiveTab('students')}
            />
          )}
          {activeTab === 'attendance' && <AttendanceDashboard />}
          {activeTab === 'students' && <StudentsPage />}
          {activeTab === 'classes' && <ClassesPage />}
          {activeTab === 'sessions' && (
            <SessionsPage onNavigateAttendance={() => setActiveTab('attendance')} />
          )}
          {activeTab === 'reports' && <ReportsPage />}
          {activeTab === 'admin' && <AdminPage />}
        </main>
      </div>
    </div>
  )
}
