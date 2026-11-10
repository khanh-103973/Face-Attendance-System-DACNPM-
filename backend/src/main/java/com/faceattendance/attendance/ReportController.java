package com.faceattendance.attendance;

import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final AttendanceStore store;

    public ReportController(AttendanceStore store) {
        this.store = store;
    }

    public record SessionBar(
            long sessionId,
            String title,
            String classCode,
            Instant date,
            Instant closedAt,
            boolean closed,
            long presentCount,
            long lateCount,
            long absentCount,
            long pendingCount,
            long totalStudents,
            double rate
    ) {}

    public record ReportRecord(
            long id,
            String studentCode,
            String fullName,
            String classCode,
            String sessionTitle,
            Instant recordedAt,
            String status,
            double cosine,
            String method
    ) {}

    public record AttendanceReport(
            long totalStudents,
            double avgPresent,
            long totalLate,
            long totalAbsent,
            long totalPending,
            long openSessions,
            long closedSessions,
            double presentRate,
            double lateRate,
            double absentRate,
            double pendingRate,
            List<SessionBar> sessionBars,
            List<ReportRecord> records
    ) {}

    @GetMapping("/attendance")
    public AttendanceReport getAttendanceReport(
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        return store.getAttendanceReport(classId, from, to);
    }
}
