/**
 * AttendanceLiveCamera.tsx — Bật webcam và gửi khung hình JPEG thô
 * tới Backend Spring Boot endpoint /api/attendance-sessions/{id}/recognize.
 */

import { useEffect, useRef, useState } from 'react'
import {
  isApiError,
  recognizeImage,
  type AttendanceRecord,
  type RecognitionOutcome,
} from '../api'

interface Props {
  sessionId: number
  onNewRecord: (record: AttendanceRecord) => void
}

const STATUS_DESCRIPTIONS: Record<string, { label: string; color: string }> = {
  recorded: { label: 'Điểm danh thành công!', color: '#16a34a' },
  already_recorded: { label: 'Đã điểm danh trước đó', color: '#ca8a04' },
  student_not_in_class: { label: 'Sinh viên không thuộc lớp này', color: '#dc2626' },
  student_not_found: { label: 'Mã SV không tồn tại trong hệ thống', color: '#dc2626' },
  unknown: { label: 'Không nhận diện được khuôn mặt', color: '#dc2626' },
  no_face: { label: 'Chưa phát hiện khuôn mặt', color: '#6b7280' },
  multiple_faces: { label: 'Có nhiều hơn 1 khuôn mặt trước camera', color: '#ea580c' },
  low_quality: { label: 'Ảnh mờ hoặc quá tối', color: '#ea580c' },
  gallery_empty: { label: 'Chưa có khuôn mặt nào được đăng ký trong hệ thống', color: '#dc2626' },
}

export default function AttendanceLiveCamera({ sessionId, onNewRecord }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [active, setActive] = useState(false)
  const [outcome, setOutcome] = useState<RecognitionOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  // Khởi động camera khi active = true
  useEffect(() => {
    if (!active) {
      stopCamera()
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
          videoRef.current.play()
        }
      })
      .catch((err) => {
        setError('Không thể mở camera: ' + (err.message || 'Bị từ chối quyền truy cập'))
        setActive(false)
      })

    return () => {
      isSubscribed = false
      stopCamera()
    }
  }, [active])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  // Vòng lặp chụp và gửi ảnh định kỳ (1.5s/lần)
  useEffect(() => {
    if (!active) return

    const interval = setInterval(async () => {
      if (processing) return
      if (!videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      if (video.readyState < 2) return // Chưa sẵn sàng khung hình

      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Chuyển canvas sang JPEG binary Blob
      canvas.toBlob(
        async (blob) => {
          if (!blob) return
          setProcessing(true)
          try {
            const res = await recognizeImage(sessionId, blob)
            setOutcome(res)
            setError(null)
            if (res.attendanceRecorded && res.record) {
              onNewRecord(res.record)
            }
          } catch (err) {
            if (isApiError(err) && err.status === 409) {
              setError('Phiên điểm danh đã đóng!')
              setActive(false)
            } else {
              setError(isApiError(err) ? err.message : 'Lỗi kết nối điểm danh')
            }
          } finally {
            setProcessing(false)
          }
        },
        'image/jpeg',
        0.85,
      )
    }, 1500)

    return () => clearInterval(interval)
  }, [active, processing, sessionId, onNewRecord])

  const statusInfo = outcome ? STATUS_DESCRIPTIONS[outcome.status] : null

  return (
    <div className="camera-box">
      <div className="camera-controls">
        <button
          className={active ? 'btn-danger' : 'btn-primary'}
          onClick={() => setActive(!active)}
        >
          {active ? 'Dừng Camera' : 'Bật Camera điểm danh'}
        </button>
        {active && processing && <span className="processing-tag">Đang xử lý ảnh...</span>}
      </div>

      {error && <div className="notice-error">{error}</div>}

      <div className="video-container" style={{ display: active ? 'block' : 'none' }}>
        <video ref={videoRef} playsInline muted className="live-video" />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Khung hiển thị kết quả trực quan trên video */}
        {outcome && (
          <div
            className="recognition-badge"
            style={{ backgroundColor: statusInfo?.color || '#374151' }}
          >
            <strong>{statusInfo?.label || outcome.status}</strong>
            {outcome.record && (
              <div>
                {outcome.record.studentCode} ({outcome.record.status}) — Cosine:{' '}
                {outcome.cosine?.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
