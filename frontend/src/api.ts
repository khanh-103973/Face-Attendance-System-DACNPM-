/**
 * api.ts — Tất cả lời gọi tới Spring Boot Backend.
 *
 * Quy tắc:
 * - Chỉ gọi /api/... (Vite proxy chuyển tiếp tới 127.0.0.1:8080).
 * - Token JWT được đọc từ sessionStorage, không bao giờ ghi vào URL.
 * - Mọi lỗi HTTP đều được ném ra dưới dạng ApiError để caller xử lý.
 * - Không bao giờ đưa AI_API_KEY hoặc JWT_SECRET ra frontend.
 */

// Dùng interface + object thay vì class extends Error để tương thích
// với erasableSyntaxOnly (TypeScript 7+).
export interface ApiError {
  readonly isApiError: true
  readonly status: number
  readonly message: string
}

export function makeApiError(status: number, message: string): ApiError {
  return { isApiError: true, status, message }
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && (e as ApiError).isApiError === true
}

// ── Token storage ──────────────────────────────────────────────────────────
// sessionStorage: token mất khi đóng tab, không bị script khác đọc qua
// localStorage cross-tab. Không dùng cookie vì backend là stateless JWT.

const TOKEN_KEY = 'fa_access_token'

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function loadToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function parseError(res: Response): Promise<ApiError> {
  let message = `HTTP ${res.status}`
  try {
    const text = await res.text()
    if (text) message = text
  } catch {
    // giữ message mặc định
  }
  return makeApiError(res.status, message)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const token = loadToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) throw await parseError(res)
  // 204 No Content → không có body
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function get<T>(path: string) {
  return request<T>('GET', path)
}

function post<T>(path: string, body?: unknown) {
  return request<T>('POST', path, body)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface UserProfile {
  username: string
  role: 'ADMIN' | 'TEACHER'
}

// ── Auth API ───────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<LoginResponse> {
  // Endpoint công khai — không cần token.
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export function getMe(): Promise<UserProfile> {
  return get<UserProfile>('/api/auth/me')
}

// ── Teacher Accounts Management (Admin only) ──────────────────────────────

export interface TeacherAccount {
  id: number
  username: string
  role: string
  enabled: boolean
}

export function getTeachers(): Promise<TeacherAccount[]> {
  return get<TeacherAccount[]>('/api/admin/teachers')
}

export function createTeacher(username: string, password: string): Promise<TeacherAccount> {
  return post('/api/admin/teachers', { username, password })
}

// ── Health (dùng kiểm tra kết nối) ────────────────────────────────────────

export function getHealth(): Promise<{ status: string; database: string }> {
  return get('/api/health')
}

// ── School Data Types & API ────────────────────────────────────────────────

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
}

export interface SchoolClass {
  id: number
  classCode: string
  name: string
}

export interface Student {
  id: number
  studentCode: string
  fullName: string
}

export function getClasses(page = 0, size = 50): Promise<PageResponse<SchoolClass>> {
  return get(`/api/classes?page=${page}&size=${size}`)
}

export function getSchoolClass(id: number): Promise<SchoolClass> {
  return get(`/api/classes/${id}`)
}

export function addClass(classCode: string, name: string): Promise<SchoolClass> {
  return post('/api/classes', { classCode, name })
}

export function updateClass(id: number, name: string): Promise<SchoolClass> {
  return request<SchoolClass>('PUT', `/api/classes/${id}`, { name })
}

export function getStudents(page = 0, size = 50): Promise<PageResponse<Student>> {
  return get(`/api/students?page=${page}&size=${size}`)
}

export function addStudent(studentCode: string, fullName: string): Promise<Student> {
  return post('/api/students', { studentCode, fullName })
}

export function updateStudent(id: number, fullName: string): Promise<Student> {
  return request<Student>('PUT', `/api/students/${id}`, { fullName })
}

export function deleteStudent(id: number): Promise<void> {
  return request<void>('DELETE', `/api/students/${id}`)
}

export function getRegisteredFaces(): Promise<string[]> {
  return get<string[]>('/api/students/registered-faces')
}

export function getClassMembers(classId: number, page = 0, size = 100): Promise<PageResponse<Student>> {
  return get(`/api/classes/${classId}/students?page=${page}&size=${size}`)
}

export function enrollStudent(classId: number, studentId: number): Promise<void> {
  return request<void>('PUT', `/api/classes/${classId}/students/${studentId}`)
}

export function unenrollStudent(classId: number, studentId: number): Promise<void> {
  return request<void>('DELETE', `/api/classes/${classId}/students/${studentId}`)
}

export interface FaceRegistrationImage {
  contentType?: 'image/jpeg' | 'image/png'
  dataBase64?: string
  content_type?: 'image/jpeg' | 'image/png'
  data_base64?: string
}

export interface FaceRegistrationResult {
  status: string
  student_id: string
  samples: number
  dimensions: number
}

export function registerStudentFace(
  studentId: number,
  consent: boolean,
  images: FaceRegistrationImage[],
): Promise<FaceRegistrationResult> {
  const normalizedImages = images.map((img) => ({
    content_type: img.content_type || img.contentType || 'image/jpeg',
    data_base64: img.data_base64 || img.dataBase64 || '',
    contentType: img.contentType || img.content_type || 'image/jpeg',
    dataBase64: img.dataBase64 || img.data_base64 || '',
  }))
  return post(`/api/students/${studentId}/register-face`, { consent, images: normalizedImages })
}

// ── Attendance Sessions & Records ──────────────────────────────────────────

export interface AttendanceSession {
  id: number
  classId: number
  title: string
  openedAt: string
  closedAt: string | null
  lateAfterMinutes: number
}

export interface AttendanceRecord {
  id: number
  sessionId: number
  studentId: number
  studentCode: string
  recordedAt: string
  status: 'PRESENT' | 'LATE'
  cosine: number
}

export interface RecognitionOutcome {
  status:
    | 'recorded'
    | 'already_recorded'
    | 'student_not_found'
    | 'student_not_in_class'
    | 'unknown'
    | 'no_face'
    | 'multiple_faces'
    | 'low_quality'
    | 'gallery_empty'
  attendanceRecorded: boolean
  record: AttendanceRecord | null
  cosine: number | null
  demo: boolean
}

export function getSessions(classId?: number, page = 0, size = 50): Promise<PageResponse<AttendanceSession>> {
  const qs = classId ? `classId=${classId}&` : ''
  return get(`/api/attendance-sessions?${qs}page=${page}&size=${size}`)
}

export function getAttendanceSession(id: number): Promise<AttendanceSession> {
  return get(`/api/attendance-sessions/${id}`)
}

export function createSession(classId: number, title: string, lateAfterMinutes = 15): Promise<AttendanceSession> {
  return post('/api/attendance-sessions', { classId, title, lateAfterMinutes })
}

export function closeSession(sessionId: number): Promise<AttendanceSession> {
  return post(`/api/attendance-sessions/${sessionId}/close`)
}

export function reopenSession(sessionId: number): Promise<AttendanceSession> {
  return post(`/api/attendance-sessions/${sessionId}/reopen`)
}

export function getSessionRecords(sessionId: number, page = 0, size = 100): Promise<PageResponse<AttendanceRecord>> {
  return get(`/api/attendance-sessions/${sessionId}/records?page=${page}&size=${size}`)
}

export async function recognizeImage(sessionId: number, imageBlob: Blob): Promise<RecognitionOutcome> {
  const token = loadToken()
  const headers: Record<string, string> = {
    'Content-Type': 'image/jpeg',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`/api/attendance-sessions/${sessionId}/recognize`, {
    method: 'POST',
    headers,
    body: imageBlob,
  })

  if (!res.ok) throw await parseError(res)
  return res.json()
}

export function manualRecordAttendance(
  sessionId: number,
  studentCode: string,
  status = 'PRESENT',
): Promise<RecognitionOutcome> {
  return post(`/api/attendance-sessions/${sessionId}/manual-record`, { studentCode, status })
}

// ── Reports API ───────────────────────────────────────────────────────────

export interface SessionBarData {
  sessionId: number
  title: string
  classCode: string
  date: string
  closedAt: string | null
  closed: boolean
  presentCount: number
  lateCount: number
  absentCount: number
  pendingCount: number
  totalStudents: number
  rate: number
}

export interface ReportRecordData {
  id: number
  studentCode: string
  fullName: string
  classCode: string
  sessionTitle: string
  recordedAt: string
  status: 'PRESENT' | 'LATE'
  cosine: number
  method: string
}

export interface AttendanceReportData {
  totalStudents: number
  avgPresent: number
  totalLate: number
  totalAbsent: number
  totalPending: number
  openSessions: number
  closedSessions: number
  presentRate: number
  lateRate: number
  absentRate: number
  pendingRate: number
  sessionBars: SessionBarData[]
  records: ReportRecordData[]
}

export function getAttendanceReport(
  classId?: number | null,
  from?: string,
  to?: string,
): Promise<AttendanceReportData> {
  const params = new URLSearchParams()
  if (classId) params.append('classId', classId.toString())
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  const qs = params.toString()
  return get<AttendanceReportData>(`/api/reports/attendance${qs ? `?${qs}` : ''}`)
}
