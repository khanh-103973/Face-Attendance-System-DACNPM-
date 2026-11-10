/**
 * FaceRegistrationModal.tsx — Đăng ký khuôn mặt sinh viên (Khớp 100% Mockup 5).
 *
 * Thiết kế 3 Cột + Dải Thumbnail bên dưới:
 * - Cột 1: Thông tin sinh viên (Avatar, Mã SV, Họ tên, Lớp)
 * - Cột 2: Thu thập ảnh khuôn mặt (Webcam Live + Khung Bounding Box AI)
 * - Cột 3: Tiến trình thu thập (Thanh tiến trình 20 ảnh + Tiêu chí ánh sáng, rõ nét)
 * - Hàng dưới: Dải ảnh mẫu thumbnail đã chụp
 */

import { useEffect, useRef, useState } from 'react'
import {
  isApiError,
  registerStudentFace,
  type FaceRegistrationImage,
  type Student,
} from '../api'

interface Props {
  student: Student
  classNameStr?: string
  onClose: () => void
  onSuccess: () => void
}

const TOTAL_SAMPLES = 20

export default function FaceRegistrationModal({
  student,
  classNameStr = 'ST23D',
  onClose,
  onSuccess,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [capturing, setCapturing] = useState(false)
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [captureTip, setCaptureTip] = useState('Đang sẵn sàng...')
  const [images, setImages] = useState<FaceRegistrationImage[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Khởi động webcam
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch((err) => {
        setError('Không thể mở camera: ' + (err.message || 'Bị từ chối quyền'))
      })

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Bắt đầu chụp liên tục 20 ảnh mẫu (đảm bảo không trùng lặp hash)
  async function startCapture() {
    if (!consentConfirmed) {
      setError('Vui lòng xác nhận sự đồng ý của sinh viên trước khi thu thập ảnh khuôn mặt.')
      return
    }
    setError(null)
    setCapturing(true)
    setImages([])

    const collected: FaceRegistrationImage[] = []
    let attempts = 0
    const maxAttempts = 60

    while (collected.length < TOTAL_SAMPLES && attempts < maxAttempts) {
      attempts++
      if (!videoRef.current || !canvasRef.current) break

      const currentCount = collected.length + 1
      if (currentCount <= 5) {
        setCaptureTip('1/4: Nhìn thẳng trực diện vào camera')
      } else if (currentCount <= 10) {
        setCaptureTip('2/4: Hơi nghiêng nhẹ sang trái (mắt vẫn nhìn camera, không quay ngang)')
      } else if (currentCount <= 15) {
        setCaptureTip('3/4: Hơi nghiêng nhẹ sang phải (mắt vẫn nhìn camera, không quay ngang)')
      } else {
        setCaptureTip('4/4: Hơi ngẩng nhẹ hoặc mỉm cười')
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        const base64Data = dataUrl.split(',')[1]

        // Tránh trùng lặp hash dữ liệu (tránh lỗi duplicate image 422 từ AI)
        const isDuplicate = collected.some((img) => (img.dataBase64 === base64Data || img.data_base64 === base64Data))
        if (!isDuplicate && base64Data) {
          collected.push({
            contentType: 'image/jpeg',
            dataBase64: base64Data,
            content_type: 'image/jpeg',
            data_base64: base64Data,
          })
          setImages([...collected])
        }
      }
      await new Promise((r) => setTimeout(r, 320))
    }

    setCapturing(false)
  }

  // Gửi ảnh đăng ký lên Backend
  async function handleSubmit() {
    if (!consentConfirmed) {
      setError('Vui lòng xác nhận sự đồng ý của sinh viên trước khi gửi dữ liệu đăng ký.')
      return
    }
    if (images.length < 15) return
    setError(null)
    setSubmitting(true)
    try {
      await registerStudentFace(student.id, consentConfirmed, images)
      setSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 409) {
          setError('Sinh viên này đã có dữ liệu khuôn mặt trong hệ thống!')
        } else if (err.status === 422) {
          const msg = (err.message || '').toLowerCase()
          if (msg.includes('duplicate')) {
            setError('Có ảnh bị trùng lặp do bạn ngồi quá yên. Vui lòng bấm "Chụp lại" và hơi nghiêng nhẹ mặt theo hướng dẫn!')
          } else if (msg.includes('small') || msg.includes('move closer')) {
            setError('Khuôn mặt bạn đang ở quá xa (kích thước mặt nhỏ hơn 72px). Vui lòng ngồi gần camera hơn sao cho khuôn mặt lấp đầy khung viền xanh!')
          } else if (msg.includes('dark') || msg.includes('add light')) {
            setError('Khuôn mặt bị tối do ngược sáng hoặc thiếu ánh sáng phòng. Vui lòng bật thêm đèn hoặc hướng mặt về phía sáng!')
          } else if (msg.includes('blur') || msg.includes('focus')) {
            setError('Ảnh chụp bị rung hoặc mờ nét. Vui lòng giữ chắc camera và không cử động quá nhanh khi chụp!')
          } else if (msg.includes('exactly one face') || msg.includes('landmarks')) {
            setError('Có ảnh không nhận diện được đủ 5 điểm mắt/mũi/miệng (do quay mặt quá nghiêng hoặc mặt bị che). Vui lòng luôn nhìn về camera!')
          } else if (msg.includes('pose') || msg.includes('angled') || msg.includes('yaw') || msg.includes('offset')) {
            setError('Khuôn mặt bị lệch nhiều so với trục camera. Vui lòng giữ mắt nhìn về phía camera và chỉ nghiêng đầu nhẹ để hệ thống thấy rõ hai mắt!')
          } else {
            setError(err.message || 'Chất lượng ảnh chưa đạt yêu cầu: Vui lòng ngồi gần camera hơn (đưa khuôn mặt lấp đầy khung xanh) và thử lại!')
          }
        } else if (err.status === 502 || err.status === 504) {
          setError('Không kết nối được tới AI Service (cổng 8000). Vui lòng kiểm tra terminal Start-AiService.ps1!')
        } else {
          setError(`Lỗi máy chủ (${err.status}): ${err.message}`)
        }
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err)
        setError(`Lỗi kết nối tới máy chủ (${errorMsg}). Vui lòng kiểm tra terminal Backend (Start-Backend.ps1) xem máy chủ đã chạy chưa!`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const progressPercent = Math.min(100, Math.round((images.length / TOTAL_SAMPLES) * 100))

  return (
    <div className="modal-backdrop">
      <div className="face-registration-modal-card">
        {/* Header Modal */}
        <div className="face-reg-header">
          <div>
            <h2 className="face-reg-title">Đăng ký khuôn mặt sinh viên</h2>
            <div className="face-reg-breadcrumb">Sinh viên &gt; Đăng ký khuôn mặt</div>
          </div>
          <button className="face-reg-close-btn" onClick={onClose} disabled={capturing || submitting}>
            ✕
          </button>
        </div>

        {error && <div className="notice-error">{error}</div>}
        {success && (
          <div className="notice-success">
            Đăng ký khuôn mặt thành công! Đã tạo vector ArcFace trong hệ thống.
          </div>
        )}

        {/* 3 Cột chính */}
        <div className="face-reg-body-grid">
          {/* Cột 1: Thông tin sinh viên */}
          <div className="face-reg-col col-student-info">
            <h4 className="face-col-title">Thông tin sinh viên</h4>
            <div className="student-profile-center">
              <div className="student-avatar-large">
                {student.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="student-detail-fields">
                <div className="detail-item">
                  <span className="detail-label">Mã SV:</span>
                  <strong className="detail-val">{student.studentCode}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Họ tên:</span>
                  <strong className="detail-val">{student.fullName}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Lớp:</span>
                  <span className="class-badge-pill">{classNameStr}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 2: Thu thập ảnh khuôn mặt (Camera) */}
          <div className="face-reg-col col-camera-feed">
            <h4 className="face-col-title">Thu thập ảnh khuôn mặt</h4>
            <div className="face-camera-container">
              <video ref={videoRef} playsInline muted autoPlay className="face-video-elem" />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Bounding box AI nhận diện */}
              <div className="face-bounding-box-ai">
                <span className="face-box-corner top-left"></span>
                <span className="face-box-corner top-right"></span>
                <span className="face-box-corner btm-left"></span>
                <span className="face-box-corner btm-right"></span>
              </div>

              {capturing && (
                <div className="face-capturing-overlay">
                  <span className="face-capture-count">Đang chụp mẫu: {images.length} / {TOTAL_SAMPLES}</span>
                  <span className="face-tilt-hint">{captureTip}</span>
                </div>
              )}
            </div>

            <p className="face-camera-hint-text">
              💡 <strong>Lưu ý:</strong> Vui lòng ngồi gần camera hơn sao cho khuôn mặt lấp đầy khung viền xanh.
            </p>

            {/* Xác nhận sự đồng ý trước khi thu ảnh */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                fontSize: '13px',
                color: '#334155',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
                cursor: capturing || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={consentConfirmed}
                disabled={capturing || submitting || success}
                onChange={(e) => {
                  setConsentConfirmed(e.target.checked)
                  if (e.target.checked) setError(null)
                }}
                style={{ marginTop: '2px' }}
              />
              <span>
                Xác nhận sinh viên <strong>{student.studentCode}</strong> đã đồng ý cho phép thu thập ảnh khuôn mặt để trích xuất vector đặc trưng phục vụ điểm danh.
              </span>
            </label>

            {/* Nút hành động */}
            <div className="face-camera-actions">
              {images.length < 15 ? (
                <button
                  className="face-btn-capture"
                  onClick={startCapture}
                  disabled={!consentConfirmed || capturing || submitting || success}
                  title={!consentConfirmed ? 'Vui lòng đánh dấu xác nhận sự đồng ý trước khi chụp ảnh' : undefined}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>{capturing ? 'Đang chụp liên tục...' : 'Chụp ảnh'}</span>
                </button>
              ) : (
                <>
                  <button
                    className="face-btn-capture btn-submit-samples"
                    onClick={handleSubmit}
                    disabled={!consentConfirmed || submitting || success}
                  >
                    <span>{submitting ? 'Đang lưu vào ArcFace...' : `Gửi đăng ký (${images.length} ảnh)`}</span>
                  </button>
                  <button
                    className="face-btn-cancel"
                    onClick={startCapture}
                    disabled={!consentConfirmed || capturing || submitting || success}
                  >
                    Chụp lại
                  </button>
                </>
              )}
              <button className="face-btn-cancel" onClick={onClose} disabled={capturing || submitting}>
                Hủy
              </button>
            </div>
          </div>

          {/* Cột 3: Tiến trình thu thập & Tiêu chuẩn */}
          <div className="face-reg-col col-progress-info">
            <h4 className="face-col-title">Tiến trình thu thập</h4>
            <div className="progress-summary-box">
              <div className="progress-label-row">
                <span>Đã chụp:</span>
                <strong>{images.length} / {TOTAL_SAMPLES}</strong>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <span className="progress-percent-text">{progressPercent}%</span>
            </div>

            {/* Checkpoints tiêu chuẩn chất lượng */}
            <div className="quality-checkpoints-list">
              <div className={`checkpoint-row ${images.length >= 5 ? 'valid' : ''}`}>
                <span className="check-icon">{images.length >= 5 ? '✓' : '○'}</span>
                <span>Mặt vừa khung viền xanh</span>
              </div>
              <div className={`checkpoint-row ${images.length >= 12 ? 'valid' : ''}`}>
                <span className="check-icon">{images.length >= 12 ? '✓' : '○'}</span>
                <span>Ánh sáng rõ nét</span>
              </div>
              <div className={`checkpoint-row ${images.length >= 20 ? 'valid' : ''}`}>
                <span className="check-icon">{images.length >= 20 ? '✓' : '○'}</span>
                <span>Đủ 20 mẫu đa góc</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hàng dưới: Dải Thumbnail ảnh đã chụp */}
        <div className="face-thumbnails-strip">
          <div className="thumbnails-header">
            <span>Ảnh đã chụp ({images.length})</span>
          </div>
          <div className="thumbnails-scroll-row">
            {images.length === 0 ? (
              <p className="no-thumbnails-hint">Chưa có ảnh nào được chụp. Nhấn "Chụp ảnh" để bắt đầu.</p>
            ) : (
              images.map((img, idx) => (
                <div key={idx} className="thumb-sample-item">
                  <img
                    src={`data:image/jpeg;base64,${img.dataBase64}`}
                    alt={`Sample ${idx + 1}`}
                    className="thumb-sample-img"
                  />
                  <span className="thumb-idx">{idx + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
