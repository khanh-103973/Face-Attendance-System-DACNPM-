/**
 * AttendanceDashboard.tsx — Màn hình Điểm danh Lớp học (Khớp 100% Mockup UI).
 *
 * Tính năng:
 * - Hàng trên: Camera nhận diện AI (Bounding box, nhãn sinh viên, FPS, trạng thái)
 *   + Thẻ Thông tin buổi điểm danh + Thẻ Danh sách nhận diện gần đây
 * - Hàng giữa: 5 Thẻ thống kê (Tổng SV, Có mặt, Đi muộn, Vắng mặt, Đồng hồ tỷ lệ %)
 * - Hàng dưới: Bảng điểm danh thời gian thực (70%) + Thao tác nhanh (30%)
 * - Tích hợp đầy đủ logic API, Webcam nhận diện, Điểm danh bù, Xuất Excel/CSV, Đăng ký khuôn mặt.
 */

import { useEffect, useRef, useState } from 'react'
import {
  closeSession,
  reopenSession,
  createSession,
  enrollStudent,
  getClasses,
  getSchoolClass,
  getAttendanceSession,
  getClassMembers,
  getSessionRecords,
  getSessions,
  getStudents,
  isApiError,
  manualRecordAttendance,
  recognizeImage,
  type AttendanceRecord,
  type AttendanceSession,
  type SchoolClass,
  type Student,
} from '../api'
import { exportAttendanceToCsv, type ExportRow } from '../exportUtils'
import FaceRegistrationModal from './FaceRegistrationModal'
import { useAuth } from '../AuthContext'
import { readAttendanceSelection, saveAttendanceSelection } from '../attendanceSelection'

export default function AttendanceDashboard() {
  const { user } = useAuth()
  const username = user!.username
  const selectedClassRef = useRef<number | null>(null)
  // ── 1. Dữ liệu Lớp học & Phiên điểm danh ──────────────────────
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [classMembers, setClassMembers] = useState<Student[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])

  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  // ── 2. Trạng thái Camera & Nhận diện AI ────────────────────────
  // MẶC ĐỊNH LÀ FALSE — CHỈ BẬT KHI PHIÊN ĐANG MỞ
  const [cameraActive, setCameraActive] = useState<boolean>(false)
  const [fps, setFps] = useState<number>(24)
  const [recentRecognized, setRecentRecognized] = useState<{
    studentCode: string
    fullName: string
    time: string
    avatar?: string
  }[]>([])
  const [activeFaceTag, setActiveFaceTag] = useState<{
    studentCode: string
    fullName: string
  } | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── 3. Modals ──────────────────────────────────────────────────
  const [showFaceRegModal, setShowFaceRegModal] = useState<boolean>(false)
  const [studentToRegister, setStudentToRegister] = useState<Student | null>(null)
  const [showStudentPickerModal, setShowStudentPickerModal] = useState<boolean>(false)

  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false)
  const [studentIdToEnroll, setStudentIdToEnroll] = useState<number | null>(null)

  const [showReportModal, setShowReportModal] = useState<boolean>(false)
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false)
  const [newSessionTitle, setNewSessionTitle] = useState<string>('')

  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Tải danh sách lớp khi load trang
  useEffect(() => {
    loadClassList()
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

  async function loadClassList() {
    try {
      const res = await getClasses(0, 100)
      const saved = readAttendanceSelection(username)
      if (saved && !res.items.some((c) => c.id === saved.classId)) {
        const rememberedClass = await getSchoolClass(saved.classId).catch(() => null)
        if (rememberedClass) res.items.push(rememberedClass)
      }
      setClasses(res.items)
      if (res.items.length > 0 && selectedClassId === null) {
        setSelectedClassId(res.items.find((c) => c.id === saved?.classId)?.id ?? res.items[0].id)
      }
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Lỗi tải danh sách lớp')
    }
  }

  // Tải thành viên và phiên khi đổi lớp
  useEffect(() => {
    selectedClassRef.current = selectedClassId
    setCameraActive(false)
    setCurrentSession(null)
    setRecords([])
    setClassMembers([])
    if (selectedClassId !== null) {
      loadSessionsForClass(selectedClassId)
      getClassMembers(selectedClassId)
        .then((res) => { if (selectedClassRef.current === selectedClassId) setClassMembers(res.items) })
        .catch(() => setClassMembers([]))
    }
  }, [selectedClassId])

  useEffect(() => {
    if (currentSession && currentSession.classId === selectedClassId) {
      saveAttendanceSelection(username, { classId: currentSession.classId, sessionId: currentSession.id })
    }
  }, [currentSession, selectedClassId, username])

  // Tải bản ghi điểm danh khi đổi phiên
  useEffect(() => {
    if (currentSession !== null) {
      loadRecordsForSession(currentSession.id)
    } else {
      setRecords([])
    }
  }, [currentSession])

  // Tự động tắt camera nếu không có phiên hoặc phiên đã đóng
  useEffect(() => {
    if (!currentSession || currentSession.closedAt !== null) {
      setCameraActive(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [currentSession])

  async function loadSessionsForClass(classId: number) {
    try {
      const res = await getSessions(classId)
      if (selectedClassRef.current !== classId) return
      const saved = readAttendanceSelection(username)
      let remembered = saved?.classId === classId ? res.items.find((s) => s.id === saved.sessionId) : undefined
      if (!remembered && saved?.classId === classId && saved.sessionId) {
        const session = await getAttendanceSession(saved.sessionId).catch(() => null)
        if (session?.classId === classId) {
          remembered = session
          res.items.push(session)
        }
      }
      if (selectedClassRef.current !== classId) return
      setSessions(res.items)
      const open = res.items.find((s) => s.closedAt === null)
      if (remembered) {
        setCurrentSession(remembered)
      } else if (open) {
        setCurrentSession(open)
      } else if (res.items.length > 0) {
        setCurrentSession(res.items[0])
      } else {
        setCurrentSession(null)
      }
    } catch {
      // bỏ qua
    }
  }

  async function loadRecordsForSession(sessionId: number) {
    try {
      const res = await getSessionRecords(sessionId)
      setRecords(res.items)
    } catch {
      // bỏ qua
    }
  }

  // Đồng bộ recentRecognized từ records thật
  useEffect(() => {
    const list = classMembers
    if (records.length > 0) {
      const recentList = records.slice(0, 5).map((r) => {
        const student = list.find((m) => m.studentCode === r.studentCode)
        return {
          studentCode: r.studentCode,
          fullName: student?.fullName ?? r.studentCode,
          time: new Date(r.recordedAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        }
      })
      setRecentRecognized(recentList)
    } else {
      setRecentRecognized([])
    }
  }, [records, classMembers, allStudents])

  // ── 4. Camera Stream Lifecycle ─────────────────────────────────
  useEffect(() => {
    if (!cameraActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      return
    }

    let isSubscribed = true
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      .then((stream) => {
        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch((err) => {
        console.warn('Webcam không mở được hoặc chưa cấp quyền:', err)
      })

    // Dao động FPS giả lập mượt mà (23 - 25 FPS)
    const fpsTimer = setInterval(() => {
      setFps(Math.floor(23 + Math.random() * 3))
    }, 2000)

    return () => {
      isSubscribed = false
      clearInterval(fpsTimer)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [cameraActive])

  // ── 5. Vòng lặp nhận diện khuôn mặt tự động ───────────────────
  const processingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!cameraActive || !currentSession || currentSession.closedAt !== null) {
      setActiveFaceTag(null)
      return
    }

    const interval = setInterval(() => {
      if (processingRef.current) return
      if (!videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      if (video.readyState < 2) return

      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        async (blob) => {
          if (!blob) return
          processingRef.current = true
          try {
            const res = await recognizeImage(currentSession.id, blob)
            if (res.record) {
              const rec = res.record
              setRecords((prev) => {
                if (prev.some((r) => r.id === rec.id)) return prev
                return [rec, ...prev]
              })
              const memberList = classMembers
              const member = memberList.find((m) => m.studentCode === rec.studentCode)
              const name = member?.fullName ?? rec.studentCode

              setActiveFaceTag({
                studentCode: rec.studentCode,
                fullName: name,
              })

              setRecentRecognized((prev) => {
                const nowStr = new Date().toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
                const filtered = prev.filter((p) => p.studentCode !== rec.studentCode)
                return [{ studentCode: rec.studentCode, fullName: name, time: nowStr }, ...filtered].slice(0, 5)
              })

              if (res.attendanceRecorded) {
                setSuccessMsg(`✓ Đã điểm danh: ${rec.studentCode} - ${name}`)
                setTimeout(() => setSuccessMsg(null), 3000)
              }
            } else if (res.status === 'student_not_in_class') {
              setActiveFaceTag({ studentCode: '', fullName: 'Sinh viên không thuộc lớp này' })
            } else if (res.status === 'unknown') {
              setActiveFaceTag({
                studentCode: 'UNKNOWN',
                fullName: 'Khuôn mặt chưa đăng ký',
              })
            } else if (res.status === 'no_face') {
              setActiveFaceTag(null)
            }
          } catch (err) {
            console.warn('Lỗi nhận diện:', err)
          } finally {
            processingRef.current = false
          }
        },
        'image/jpeg',
        0.85,
      )
    }, 1200)

    return () => {
      clearInterval(interval)
      setActiveFaceTag(null)
    }
  }, [cameraActive, currentSession?.id, currentSession?.closedAt, classMembers, allStudents])

  // ── 6. Hành động Điểm danh bù (Manual Mark) ────────────────────
  async function handleManualMark(studentCode: string) {
    if (!currentSession) return
    try {
      const res = await manualRecordAttendance(currentSession.id, studentCode, 'PRESENT')
      if (res.status === 'student_not_in_class') {
        setErrorMsg('Sinh viên không thuộc lớp này')
        return
      }
      if (res.record) {
        const rec = res.record
        setRecords((prev) => [rec, ...prev.filter((r) => r.id !== rec.id)])
        const member = classMembers.find((m) => m.studentCode === studentCode)
        const name = member?.fullName ?? studentCode
        setActiveFaceTag({ studentCode, fullName: name })
        setSuccessMsg(`Điểm danh bù thành công cho ${studentCode} - ${name}`)
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể điểm danh thủ công')
      setTimeout(() => setErrorMsg(null), 3000)
    }
  }

  // ── 7. Hành động Dừng / Tiếp tục / Mở Phiên điểm danh ─────────────
  async function handleToggleSession() {
    if (!currentSession) {
      setShowNewSessionModal(true)
      return
    }

    if (currentSession.closedAt === null) {
      // Dừng / Tạm dừng điểm danh
      try {
        const closed = await closeSession(currentSession.id)
        setCurrentSession(closed)
        setCameraActive(false)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        if (selectedClassId) loadSessionsForClass(selectedClassId)
        setSuccessMsg(`Đã đóng phiên điểm danh "${currentSession.title}" và tắt camera. Bạn có thể bấm "Tiếp tục điểm danh" để mở lại bất cứ lúc nào!`)
        setTimeout(() => setSuccessMsg(null), 3500)
      } catch (err) {
        setErrorMsg(isApiError(err) ? err.message : 'Lỗi khi đóng phiên')
      }
    } else {
      // Mở lại phiên điểm danh này để tiếp tục điểm danh
      handleReopenCurrentSession()
    }
  }

  async function handleReopenCurrentSession() {
    if (!currentSession) return
    try {
      const reopened = await reopenSession(currentSession.id)
      setCurrentSession(reopened)
      setCameraActive(false)
      if (selectedClassId) loadSessionsForClass(selectedClassId)
      setSuccessMsg(`Đã mở lại "${currentSession.title}" để tiếp tục điểm danh. Bạn có thể đánh dấu có mặt thủ công hoặc bật camera.`)
      setTimeout(() => setSuccessMsg(null), 3500)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể mở lại phiên điểm danh')
    }
  }

  async function handleCreateNewSession(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClassId || !newSessionTitle.trim()) return
    try {
      const created = await createSession(selectedClassId, newSessionTitle.trim())
      saveAttendanceSelection(username, { classId: selectedClassId, sessionId: created.id })
      setNewSessionTitle('')
      setShowNewSessionModal(false)
      setCurrentSession(created)
      setCameraActive(false)
      loadSessionsForClass(selectedClassId)
      setSuccessMsg('Đã mở phiên điểm danh mới. Chọn Có mặt trong danh sách hoặc bật camera để nhận diện.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể tạo phiên mới')
    }
  }

  // ── 8. Hành động Xuất Excel / CSV ─────────────────────────────
  function handleExportExcel() {
    if (!currentSession) {
      setErrorMsg('Chưa có phiên điểm danh nào để xuất báo cáo!')
      setTimeout(() => setErrorMsg(null), 3000)
      return
    }
    const curClass = classes.find((c) => c.id === selectedClassId)
    const className = curClass ? `${curClass.classCode} - ${curClass.name}` : 'Lớp học'

    const rows: ExportRow[] = classMembers.map((student, idx) => {
      const rec = records.find((r) => r.studentCode === student.studentCode)
      if (rec) {
        const isManual = rec.cosine >= 0.9999
        return {
          index: idx + 1,
          studentCode: student.studentCode,
          fullName: student.fullName,
          status: rec.status === 'PRESENT' ? 'Có mặt' : 'Đi muộn',
          recordedAt: new Date(rec.recordedAt).toLocaleTimeString('vi-VN'),
          cosine: isManual ? '-' : rec.cosine.toFixed(3),
          method: isManual ? 'Thủ công' : 'Khuôn mặt (ArcFace)',
        }
      }
      return {
        index: idx + 1,
        studentCode: student.studentCode,
        fullName: student.fullName,
        status: currentSession.closedAt ? 'Vắng mặt' : 'Chưa điểm danh',
        recordedAt: '-',
        cosine: '-',
        method: '-',
      }
    })

    exportAttendanceToCsv(currentSession.title, className, rows)
    setSuccessMsg('Đã xuất file điểm danh Excel (CSV UTF-8) thành công!')
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  // ── 9. Thêm sinh viên vào lớp nhanh ───────────────────────────
  async function handleQuickEnroll(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClassId || !studentIdToEnroll) return
    try {
      await enrollStudent(selectedClassId, studentIdToEnroll)
      setShowAddMemberModal(false)
      setStudentIdToEnroll(null)
      const res = await getClassMembers(selectedClassId)
      setClassMembers(res.items)
      setSuccessMsg('Đã thêm sinh viên vào lớp thành công!')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setErrorMsg(isApiError(err) ? err.message : 'Không thể thêm sinh viên vào lớp')
    }
  }

  // ── 10. Tính toán các chỉ số thống kê ─────────────────────────
  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const displayMembers = classMembers
  const displayTotalStudents = displayMembers.length
  const presentStudents = records.filter((r) => r.status === 'PRESENT').length
  const lateStudents = records.filter((r) => r.status === 'LATE').length
  const absentStudents = Math.max(0, displayTotalStudents - records.length)
  const attendanceRate = displayTotalStudents > 0 ? ((records.length / displayTotalStudents) * 100).toFixed(1) : '0.0'

  // Tính chu vi SVG vòng tròn đo tỷ lệ %
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (parseFloat(attendanceRate) / 100) * circumference

  return (
    <div className="attendance-dashboard-layout">
      {/* Thông báo nổi */}
      {errorMsg && <div className="floating-toast toast-error">{errorMsg}</div>}
      {successMsg && <div className="floating-toast toast-success">{successMsg}</div>}

      {/* ============================================================
          HÀNG 1: CAMERA AI + THÔNG TIN PHIÊN + DANH SÁCH NHẬN DIỆN
          ============================================================ */}
      <section className="top-dashboard-grid">
        {/* 1.1 Khung Camera Live nhận diện */}
        <div className="camera-feed-card">
          {/* Huy hiệu trạng thái trên góc trái */}
          {cameraActive && currentSession && currentSession.closedAt === null ? (
            <div className="camera-live-badge">
              <span className="live-dot-pulse"></span>
              <span>Đang nhận diện...</span>
            </div>
          ) : currentSession?.closedAt === null ? (
            <div className="camera-live-badge badge-paused">
              <span>⏸ Camera đang tạm dừng</span>
            </div>
          ) : (
            <div className="camera-live-badge badge-closed-pill">
              <span>⏹ Phiên đã đóng</span>
            </div>
          )}

          {/* Video Stream thật hoặc Standby Viewport */}
          <div className="camera-viewport">
            {cameraActive && currentSession && currentSession.closedAt === null ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="camera-video-elem active"
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Bounding box AI nhận diện khuôn mặt */}
                <div className={`ai-face-box ${activeFaceTag ? 'active' : ''}`}>
                  <div className="corner-top-left"></div>
                  <div className="corner-top-right"></div>
                  <div className="corner-bottom-left"></div>
                  <div className="corner-bottom-right"></div>
                </div>

                {/* Nhãn sinh viên nhận diện dưới bounding box */}
                <div className="ai-recognized-pill">
                  {activeFaceTag ? (
                    activeFaceTag.studentCode === 'UNKNOWN' ? (
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>Chưa nhận diện được</span>
                    ) : (
                      <>
                        <span>{activeFaceTag.studentCode} - {activeFaceTag.fullName}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </>
                    )
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Đang quét khuôn mặt...</span>
                  )}
                </div>
              </>
            ) : (
              <div className="camera-standby-placeholder">
                <div className="standby-icon-circle">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                </div>
                <div className="standby-title">
                  {currentSession?.closedAt === null
                    ? 'Camera đang tắt'
                    : currentSession
                      ? `Phiên "${currentSession.title}" đang tạm dừng / đã đóng`
                      : 'Chưa có buổi học nào'}
                </div>
                <p className="standby-desc">
                  {currentSession?.closedAt === null
                    ? 'Phiên điểm danh đang mở. Bấm nút dưới để bật camera nhận diện.'
                    : currentSession
                      ? 'Bạn có thể tiếp tục điểm danh lại buổi học này hoặc tạo buổi học mới.'
                      : 'Vui lòng mở một phiên điểm danh để bắt đầu.'}
                </p>
                {currentSession?.closedAt === null ? (
                  <button className="btn-primary" onClick={() => setCameraActive(true)}>
                    📷 Bật Camera điểm danh
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {currentSession && (
                      <button
                        className="btn-primary"
                        onClick={handleReopenCurrentSession}
                        style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>Tiếp tục điểm danh ({currentSession.title})</span>
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => setShowNewSessionModal(true)}>
                      + Mở buổi học mới
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Overlay dưới cùng của Camera: FPS & Nút điều khiển */}
          <div className="camera-bottom-overlay">
            <span className="camera-fps-tag">
              {cameraActive ? `FPS: ${fps}` : 'FPS: 0'}
            </span>
            <div className="camera-actions-group">
              <button
                className="camera-ctrl-btn"
                title={cameraActive ? 'Tắt Camera' : 'Bật Camera'}
                disabled={!currentSession || currentSession.closedAt !== null}
                onClick={() => setCameraActive(!cameraActive)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <button
                className="camera-ctrl-btn"
                title="Toàn màn hình"
                onClick={() => {
                  const elem = document.querySelector('.camera-feed-card')
                  if (!document.fullscreenElement) elem?.requestFullscreen().catch(() => {})
                  else document.exitFullscreen().catch(() => {})
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 1.2 Thẻ Thông tin buổi điểm danh */}
        <div className="card-box session-info-card">
          <div className="card-header-with-icon">
            <div className="card-header-icon blue-icon-bg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="card-header-title">Thông tin buổi điểm danh</h3>
          </div>

          <div className="session-info-form">
            <div className="session-info-row">
              <span className="session-label">Lớp học:</span>
              <div className="session-value-pill">
                <select
                  className="inline-class-select"
                  value={selectedClassId ?? ''}
                  onChange={(e) => {
                    const classId = Number(e.target.value)
                    saveAttendanceSelection(username, { classId, sessionId: null })
                    setSelectedClassId(classId)
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.classCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="session-info-row">
              <span className="session-label">Môn học:</span>
              <div className="session-value-pill text-truncate" title={selectedClass?.name || 'Chưa chọn lớp'}>
                {selectedClass?.name || 'Học sâu (Deep Learning)'}
              </div>
            </div>

            <div className="session-info-row">
              <span className="session-label">Buổi:</span>
              <div className="session-value-pill">
                {sessions.length > 0 ? (
                  <select
                    className="inline-class-select"
                    value={currentSession?.id ?? ''}
                    onChange={(e) => {
                      const s = sessions.find((x) => x.id === Number(e.target.value))
                      if (s) {
                        saveAttendanceSelection(username, { classId: s.classId, sessionId: s.id })
                        setCurrentSession(s)
                      }
                    }}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} {s.closedAt ? '(Đã đóng)' : '(Đang mở)'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>Chưa có buổi học</span>
                )}
              </div>
            </div>

            <div className="session-info-row">
              <span className="session-label">Thời gian:</span>
              <div className="session-value-pill">
                {currentSession
                  ? `${new Date(currentSession.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${
                      currentSession.closedAt
                        ? new Date(currentSession.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '18:30'
                    }`
                  : '16:30 - 18:30'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button
              className={`session-toggle-btn ${currentSession?.closedAt === null ? 'btn-stop-session' : 'btn-start-session'}`}
              onClick={handleToggleSession}
              style={{ flex: 1 }}
            >
              {currentSession?.closedAt === null ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  <span>Đóng phiên điểm danh</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>{currentSession ? 'Mở lại phiên điểm danh' : 'Mở phiên điểm danh'}</span>
                </>
              )}
            </button>
            {currentSession?.closedAt !== null && (
              <button
                className="btn-secondary"
                onClick={() => setShowNewSessionModal(true)}
                title="Tạo buổi học mới"
                style={{ padding: '0 12px', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                + Buổi mới
              </button>
            )}
          </div>
        </div>

        {/* 1.3 Thẻ Danh sách nhận diện gần đây */}
        <div className="card-box recent-recognition-card">
          <div className="card-header-with-icon">
            <div className="card-header-icon blue-icon-bg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="card-header-title">
              Danh sách nhận diện ({recentRecognized.length})
            </h3>
          </div>

          <div className="recent-recognition-list">
            {recentRecognized.length > 0 ? (
              recentRecognized.map((item, idx) => (
                <div key={idx} className="recent-student-item">
                  <div className="recent-student-avatar">
                    {item.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="recent-student-info">
                    <div className="recent-student-name">
                      {item.studentCode} - {item.fullName}
                    </div>
                    <span className="badge-present-subtle">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Có mặt
                    </span>
                  </div>
                  <div className="recent-student-time">{item.time}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Chưa có lượt điểm danh nào trong phiên này
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          HÀNG 2: 5 THẺ THỐNG KÊ (STATS CARDS)
          ============================================================ */}
      <section className="stats-metric-grid">
        {/* Card 1: Tổng SV lớp */}
        <div className="metric-card">
          <div className="metric-icon-circle blue-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="metric-text-group">
            <span className="metric-value">{displayTotalStudents}</span>
            <span className="metric-label">Tổng SV lớp</span>
          </div>
        </div>

        {/* Card 2: Có mặt */}
        <div className="metric-card">
          <div className="metric-icon-circle green-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="metric-text-group">
            <span className="metric-value">{presentStudents}</span>
            <span className="metric-label">Có mặt</span>
          </div>
        </div>

        {/* Card 3: Đi muộn */}
        <div className="metric-card">
          <div className="metric-icon-circle orange-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="metric-text-group">
            <span className="metric-value">{lateStudents}</span>
            <span className="metric-label">Đi muộn</span>
          </div>
        </div>

        {/* Card 4: Vắng mặt */}
        <div className="metric-card">
          <div className="metric-icon-circle red-circle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div className="metric-text-group">
            <span className="metric-value">{absentStudents}</span>
            <span className="metric-label">{currentSession?.closedAt ? 'Vắng mặt' : 'Chưa điểm danh'}</span>
          </div>
        </div>

        {/* Card 5: Tỷ lệ chuyên cần (Donut progress) */}
        <div className="metric-card metric-card-donut">
          <div className="donut-meter-container">
            <svg className="donut-svg" width="60" height="60">
              <circle
                className="donut-bg-circle"
                stroke="#e2e8f0"
                strokeWidth="5"
                fill="transparent"
                r={radius}
                cx="30"
                cy="30"
              />
              <circle
                className="donut-fill-circle"
                stroke="#10b981"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                r={radius}
                cx="30"
                cy="30"
              />
            </svg>
            <span className="donut-percentage-text">
              {displayTotalStudents > 0 ? `${attendanceRate}%` : '0.0%'}
            </span>
          </div>
          <div className="metric-text-group">
            <span className="metric-label-standalone">Tỷ lệ chuyên cần</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          HÀNG 3: BẢNG ĐIỂM DANH THỜI GIAN THỰC (70%) + THAO TÁC NHANH (30%)
          ============================================================ */}
      <section className="bottom-dashboard-grid">
        {/* 3.1 Bảng Danh sách điểm danh theo thời gian thực */}
        <div className="card-box realtime-table-card">
          <div className="card-header-with-icon">
            <div className="card-header-icon blue-icon-bg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="card-header-title">Danh sách điểm danh theo thời gian thực</h3>
          </div>

          <p style={{ padding: '0 24px', color: '#64748b' }}>
            {currentSession?.closedAt === null
              ? 'Bấm Có mặt tại dòng sinh viên để điểm danh thủ công. Bạn có thể bật camera khi cần nhận diện.'
              : 'Phiên đã đóng hoặc chưa được mở. Hãy mở phiên để đánh dấu có mặt thủ công hoặc sử dụng camera.'}
          </p>
          <div className="table-responsive-container">
            <table className="realtime-attendance-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th style={{ width: '110px' }}>Mã SV</th>
                  <th>Họ và tên</th>
                  <th style={{ width: '130px' }}>Trạng thái</th>
                  <th style={{ width: '120px' }}>Thời gian</th>
                  <th style={{ width: '145px' }}>Điểm danh thủ công</th>
                </tr>
              </thead>
              <tbody>
                {displayMembers.length > 0 ? (
                  displayMembers.map((student, idx) => {
                    const rec = records.find((r) => r.studentCode === student.studentCode)
                    const isPresent = Boolean(rec)
                    const timeDisplay = rec
                      ? new Date(rec.recordedAt).toLocaleTimeString('vi-VN')
                      : '-'

                    return (
                      <tr key={student.id || idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong className="student-code-text">{student.studentCode}</strong>
                        </td>
                        <td className="student-name-text">{student.fullName}</td>
                        <td>
                          {isPresent ? (
                            <span className="badge-present-pill">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {rec?.status === 'LATE' ? 'Đi muộn' : 'Có mặt'}
                            </span>
                          ) : (
                            <span className="badge-absent-pill">{currentSession?.closedAt ? 'Vắng mặt' : 'Chưa điểm danh'}</span>
                          )}
                        </td>
                        <td className="time-cell">{timeDisplay}</td>
                        <td>
                          {isPresent ? (
                            <span className="empty-dash">-</span>
                          ) : (
                            <button
                              className="btn-mark-manual-pill"
                              onClick={() => handleManualMark(student.studentCode)}
                              disabled={!currentSession || currentSession.closedAt !== null}
                              title={currentSession?.closedAt === null ? 'Đánh dấu có mặt bằng thao tác' : 'Mở phiên điểm danh để đánh dấu có mặt'}
                            >
                              ✓ Có mặt
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      Chưa có sinh viên nào trong danh sách.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3.2 Bảng Thao tác nhanh */}
        <div className="card-box quick-actions-card">
          <div className="card-header-with-icon">
            <div className="card-header-icon blue-icon-bg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="card-header-title">Thao tác nhanh</h3>
          </div>

          <div className="quick-actions-list">
            {/* 1. Đăng ký khuôn mặt mới (Chỉ dành cho ADMIN) */}
            {user?.role === 'ADMIN' && (
              <button
                className="quick-action-btn"
                onClick={() => {
                  if (classMembers.length > 0) {
                    setStudentToRegister(classMembers[0])
                  }
                  setShowStudentPickerModal(true)
                }}
              >
                <div className="action-btn-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <span className="action-btn-text">Đăng ký khuôn mặt mới</span>
              </button>
            )}

            {/* 2. Thêm sinh viên vào lớp */}
            <button
              className="quick-action-btn"
              onClick={() => setShowAddMemberModal(true)}
            >
              <div className="action-btn-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <span className="action-btn-text">Thêm sinh viên vào lớp</span>
            </button>

            {/* 3. Xuất kết quả Excel */}
            <button className="quick-action-btn" onClick={handleExportExcel}>
              <div className="action-btn-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <span className="action-btn-text">Xuất kết quả Excel</span>
            </button>

            {/* 4. Xem báo cáo buổi học */}
            <button className="quick-action-btn" onClick={() => setShowReportModal(true)}>
              <div className="action-btn-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <span className="action-btn-text">Xem báo cáo buổi học</span>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          MODALS & POPUPS
          ============================================================ */}

      {/* Modal 1: Chọn sinh viên để Đăng ký khuôn mặt */}
      {showStudentPickerModal && (
        <div className="modal-backdrop" onClick={() => setShowStudentPickerModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đăng ký khuôn mặt mới</h3>
              <button className="modal-close-btn" onClick={() => setShowStudentPickerModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label>
                <strong>Chọn sinh viên cần thu thập ảnh khuôn mặt:</strong>
              </label>
              <select
                className="full-width-select"
                value={studentToRegister?.id ?? ''}
                onChange={(e) => {
                  const s = (classMembers).find(
                    (item) => item.id === Number(e.target.value),
                  )
                  if (s) setStudentToRegister(s)
                }}
              >
                {(classMembers).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.studentCode} — {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowStudentPickerModal(false)}>
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowStudentPickerModal(false)
                  setShowFaceRegModal(true)
                }}
                disabled={!studentToRegister}
              >
                Tiếp tục quét camera 20 ảnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Quét Camera 20 ảnh khuôn mặt thật */}
      {showFaceRegModal && studentToRegister && (
        <FaceRegistrationModal
          student={studentToRegister}
          onClose={() => setShowFaceRegModal(false)}
          onSuccess={() => {
            setShowFaceRegModal(false)
            setSuccessMsg(`Đã đăng ký khuôn mặt cho ${studentToRegister.fullName} thành công!`)
            setTimeout(() => setSuccessMsg(null), 3000)
          }}
        />
      )}

      {/* Modal 3: Thêm sinh viên vào lớp */}
      {showAddMemberModal && (
        <div className="modal-backdrop" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleQuickEnroll}>
              <div className="modal-header">
                <h3>Thêm sinh viên vào lớp {selectedClass?.classCode}</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <label>
                  <strong>Chọn sinh viên từ hệ thống:</strong>
                </label>
                <select
                  className="full-width-select"
                  value={studentIdToEnroll ?? ''}
                  onChange={(e) => setStudentIdToEnroll(Number(e.target.value))}
                  required
                >
                  <option value="">-- Chọn sinh viên --</option>
                  {allStudents
                    .filter((s) => !classMembers.some((m) => m.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.studentCode} — {s.fullName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={!studentIdToEnroll}>
                  + Thêm vào lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Xem báo cáo buổi học */}
      {showReportModal && (
        <div className="modal-backdrop" onClick={() => setShowReportModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Báo cáo buổi học: {currentSession ? currentSession.title : 'Buổi 06'}</h3>
              <button className="modal-close-btn" onClick={() => setShowReportModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Lớp học:</strong> {selectedClass?.classCode} — {selectedClass?.name}
              </p>
              <p>
                <strong>Tổng số sinh viên:</strong> {displayTotalStudents} sinh viên
              </p>
              <p>
                <strong>Số sinh viên có mặt:</strong>{' '}
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                  {records.length} sinh viên ({attendanceRate}%)
                </span>
              </p>
              <p>
                <strong>Số sinh viên vắng mặt:</strong>{' '}
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                  {absentStudents} sinh viên
                </span>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowReportModal(false)}>
                Đóng
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowReportModal(false)
                  handleExportExcel()
                }}
              >
                Xuất file Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Mở phiên điểm danh mới */}
      {showNewSessionModal && (
        <div className="modal-backdrop" onClick={() => setShowNewSessionModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateNewSession}>
              <div className="modal-header">
                <h3>Mở phiên điểm danh mới cho lớp {selectedClass?.classCode}</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowNewSessionModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <label>
                  <strong>Tiêu đề buổi điểm danh:</strong>
                </label>
                <input
                  type="text"
                  className="full-width-input"
                  placeholder="VD: Buổi 06 - Học sâu (Deep Learning)"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  required
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNewSessionModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Bắt đầu điểm danh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
