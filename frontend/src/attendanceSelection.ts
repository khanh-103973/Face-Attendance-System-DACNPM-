export interface AttendanceSelection {
  classId: number
  sessionId: number | null
}

export function readAttendanceSelection(username: string): AttendanceSelection | null {
  try {
    const value = JSON.parse(localStorage.getItem(`attendance-selection:${username}`) || 'null')
    if (!value || !Number.isSafeInteger(value.classId) || value.classId <= 0) return null
    return {
      classId: value.classId,
      sessionId: Number.isSafeInteger(value.sessionId) && value.sessionId > 0 ? value.sessionId : null,
    }
  } catch {
    return null
  }
}

export function saveAttendanceSelection(username: string, selection: AttendanceSelection): void {
  try {
    localStorage.setItem(`attendance-selection:${username}`, JSON.stringify(selection))
  } catch {
    // The selection remains usable when browser storage is unavailable.
  }
}
