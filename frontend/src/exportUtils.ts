/**
 * exportUtils.ts — Tiện ích xuất dữ liệu điểm danh ra file CSV / Excel.
 * Sử dụng UTF-8 BOM (\uFEFF) để Excel trên Windows hiển thị đúng tiếng Việt có dấu.
 */

export interface ExportRow {
  index: number
  studentCode: string
  fullName: string
  status: string
  recordedAt: string
  cosine: string
  method: string
}

export function exportAttendanceToCsv(
  sessionTitle: string,
  className: string,
  rows: ExportRow[],
) {
  const headers = [
    'STT',
    'Mã sinh viên',
    'Họ và tên',
    'Trạng thái',
    'Thời gian điểm danh',
    'Độ tương đồng (Cosine)',
    'Phương thức',
  ]

  const csvRows: string[] = []
  // Header thông tin phiên
  csvRows.push(`"BÁO CÁO ĐIỂM DANH - ${sessionTitle.replace(/"/g, '""')}"`)
  csvRows.push(`"Lớp học: ${className.replace(/"/g, '""')}"`)
  csvRows.push(`"Ngày xuất: ${new Date().toLocaleString('vi-VN')}"`)
  csvRows.push('') // Dòng trống

  // Dòng tiêu đề cột
  csvRows.push(headers.map((h) => `"${h}"`).join(','))

  // Dữ liệu từng sinh viên
  rows.forEach((r) => {
    const row = [
      r.index,
      `"${r.studentCode}"`,
      `"${r.fullName.replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.recordedAt}"`,
      `"${r.cosine}"`,
      `"${r.method}"`,
    ]
    csvRows.push(row.join(','))
  })

  // Thêm UTF-8 BOM (\uFEFF) để Excel tự nhận UTF-8
  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  const safeFilename = `DiemDanh_${sessionTitle.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')}_${Date.now()}.csv`
  link.setAttribute('download', safeFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
