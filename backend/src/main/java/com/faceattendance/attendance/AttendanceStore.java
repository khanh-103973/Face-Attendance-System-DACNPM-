package com.faceattendance.attendance;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class AttendanceStore {
    private final JdbcTemplate jdbc;
    public AttendanceStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Session(long id, long classId, String title, Instant openedAt, Instant closedAt, int lateAfterMinutes) {}
    public record Record(long id, long sessionId, long studentId, String studentCode, Instant recordedAt, String status, double cosine) {}
    public record Page<T>(List<T> items, int page, int size, long totalElements) {}
    public record Outcome(String status, boolean attendanceRecorded, Record record, Double cosine, boolean demo) {}
    private Session sessionRow(ResultSet rs, int row) throws SQLException {
        var closed = rs.getTimestamp("closed_at");
        return new Session(rs.getLong("id"), rs.getLong("class_id"), rs.getString("title"),
                rs.getTimestamp("opened_at").toInstant(), closed == null ? null : closed.toInstant(), rs.getInt("late_after_minutes"));
    }
    private Record recordRow(ResultSet rs, int row) throws SQLException {
        return new Record(rs.getLong("id"), rs.getLong("session_id"), rs.getLong("student_id"), rs.getString("student_code"),
                rs.getTimestamp("recorded_at").toInstant(), rs.getString("status"), rs.getDouble("cosine"));
    }
    private static ResponseStatusException missing() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found"); }
    public Session get(long id) {
        return jdbc.query("SELECT * FROM attendance_sessions WHERE id = ?", this::sessionRow, id).stream().findFirst().orElseThrow(AttendanceStore::missing);
    }
    public Session requireOpen(long id) { var session = get(id); checkOpen(session); return session; }
    private static void checkOpen(Session session) {
        if (session.closedAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Attendance session is closed");
    }
    @Transactional
    public Session create(long classId, String title, int lateMinutes, String actor) {
        if (jdbc.queryForList("SELECT id FROM classes WHERE id = ? FOR KEY SHARE", Long.class, classId).isEmpty()) throw missing();
        return jdbc.query("INSERT INTO attendance_sessions (class_id, title, late_after_minutes, created_by) "
                        + "VALUES (?, ?, ?, (SELECT id FROM users WHERE username = ? AND enabled)) RETURNING *",
                this::sessionRow, classId, title.strip(), lateMinutes, actor).getFirst();
    }
    @Transactional
    public Session close(long id) {
        lock(id);
        return jdbc.query("UPDATE attendance_sessions SET closed_at = COALESCE(closed_at, clock_timestamp()) WHERE id = ? RETURNING *",
                this::sessionRow, id).getFirst();
    }
    @Transactional
    public Session reopen(long id) {
        Session session = lock(id);
        Long openCount = jdbc.queryForObject(
                "SELECT count(*) FROM attendance_sessions WHERE class_id = ? AND closed_at IS NULL AND id <> ?",
                Long.class, session.classId(), id);
        if (openCount != null && openCount > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lớp học này đang có một phiên điểm danh khác đang mở");
        }
        return jdbc.query("UPDATE attendance_sessions SET closed_at = NULL WHERE id = ? RETURNING *",
                this::sessionRow, id).getFirst();
    }
    private Session lock(long id) {
        return jdbc.query("SELECT * FROM attendance_sessions WHERE id = ? FOR UPDATE", this::sessionRow, id)
                .stream().findFirst().orElseThrow(AttendanceStore::missing);
    }
    @Transactional
    public Outcome record(long id, String code, double score) {
        // Recheck after inference and serialize with close/other writes to this session.
        Session session = lock(id);
        checkOpen(session);
        var ids = jdbc.queryForList("SELECT id FROM students WHERE student_code = ? FOR KEY SHARE", Long.class, code);
        if (ids.isEmpty()) return new Outcome("student_not_found", false, null, score, true);
        long studentId = ids.getFirst();
        var membership = jdbc.queryForList("SELECT id FROM class_students WHERE class_id = ? AND student_id = ? FOR KEY SHARE",
                Long.class, session.classId(), studentId);
        if (membership.isEmpty()) {
            return new Outcome("student_not_in_class", false, null, score, true);
        }
        var inserted = jdbc.queryForList("INSERT INTO attendance_records (session_id, student_id, recorded_at, status, cosine) "
                        + "VALUES (?, ?, clock_timestamp(), CASE WHEN clock_timestamp() > ?::timestamptz + (? * INTERVAL '1 minute') "
                        + "THEN 'LATE' ELSE 'PRESENT' END, ?) ON CONFLICT (session_id, student_id) DO NOTHING RETURNING id",
                Long.class, id, studentId, session.openedAt().toString(), session.lateAfterMinutes(), score);
        Record record = jdbc.query("SELECT r.*, s.student_code FROM attendance_records r JOIN students s ON s.id = r.student_id "
                + "WHERE r.session_id = ? AND r.student_id = ?", this::recordRow, id, studentId).getFirst();
        return new Outcome(inserted.isEmpty() ? "already_recorded" : "recorded", !inserted.isEmpty(), record, score, true);
    }
    @Transactional
    public Outcome manualRecord(long id, String code, String status) {
        Session session = lock(id);
        checkOpen(session);
        var ids = jdbc.queryForList("SELECT id FROM students WHERE student_code = ? FOR KEY SHARE", Long.class, code);
        if (ids.isEmpty()) return new Outcome("student_not_found", false, null, 1.0, true);
        long studentId = ids.getFirst();
        var membership = jdbc.queryForList("SELECT id FROM class_students WHERE class_id = ? AND student_id = ? FOR KEY SHARE",
                Long.class, session.classId(), studentId);
        if (membership.isEmpty()) {
            return new Outcome("student_not_in_class", false, null, null, true);
        }
        String finalStatus = "LATE".equalsIgnoreCase(status) ? "LATE" : "PRESENT";
        jdbc.update("INSERT INTO attendance_records (session_id, student_id, recorded_at, status, cosine) "
                        + "VALUES (?, ?, clock_timestamp(), ?, 1.0) ON CONFLICT (session_id, student_id) "
                        + "DO UPDATE SET status = EXCLUDED.status, recorded_at = clock_timestamp()",
                id, studentId, finalStatus);
        Record record = jdbc.query("SELECT r.*, s.student_code FROM attendance_records r JOIN students s ON s.id = r.student_id "
                + "WHERE r.session_id = ? AND r.student_id = ?", this::recordRow, id, studentId).getFirst();
        return new Outcome("recorded", true, record, 1.0, true);
    }
    static void validatePage(int page, int size) {
        if (page < 0 || page > 1_000_000 || size < 1 || size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or size");
    }
    public Page<Session> sessions(long classId, int page, int size) {
        validatePage(page, size);
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM classes WHERE id = ?)", Boolean.class, classId))) throw missing();
        var items = jdbc.query("SELECT * FROM attendance_sessions WHERE class_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
                this::sessionRow, classId, size, (long)page * size);
        Long count = jdbc.queryForObject("SELECT count(*) FROM attendance_sessions WHERE class_id = ?", Long.class, classId);
        return new Page<>(items, page, size, count == null ? 0 : count);
    }
    public Page<Record> records(long id, int page, int size) {
        validatePage(page, size); get(id);
        var items = jdbc.query("SELECT r.*, s.student_code FROM attendance_records r JOIN students s ON s.id = r.student_id "
                + "WHERE r.session_id = ? ORDER BY r.id LIMIT ? OFFSET ?", this::recordRow, id, size, (long)page * size);
        Long count = jdbc.queryForObject("SELECT count(*) FROM attendance_records WHERE session_id = ?", Long.class, id);
        return new Page<>(items, page, size, count == null ? 0 : count);
    }

    public Page<Session> allSessions(int page, int size) {
        validatePage(page, size);
        var items = jdbc.query("SELECT * FROM attendance_sessions ORDER BY id DESC LIMIT ? OFFSET ?",
                this::sessionRow, size, (long) page * size);
        Long count = jdbc.queryForObject("SELECT count(*) FROM attendance_sessions", Long.class);
        return new Page<>(items, page, size, count == null ? 0 : count);
    }

    public ReportController.AttendanceReport getAttendanceReport(Long classId, String fromStr, String toStr) {
        Long countStudents;
        if (classId != null && classId > 0) {
            countStudents = jdbc.queryForObject(
                    "SELECT count(*) FROM class_students WHERE class_id = ?", Long.class, classId);
        } else {
            countStudents = jdbc.queryForObject(
                    "SELECT count(DISTINCT student_id) FROM class_students", Long.class);
        }
        long totalStudents = countStudents != null ? countStudents : 0L;

        StringBuilder sessionSql = new StringBuilder(
                "SELECT s.id, s.class_id, c.class_code, s.title, s.opened_at, s.closed_at, " +
                "(SELECT count(*) FROM class_students cs WHERE cs.class_id = s.class_id) AS class_student_count " +
                "FROM attendance_sessions s JOIN classes c ON c.id = s.class_id WHERE 1=1 ");
        List<Object> params = new java.util.ArrayList<>();
        if (classId != null && classId > 0) {
            sessionSql.append("AND s.class_id = ? ");
            params.add(classId);
        }
        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        if (fromStr != null && !fromStr.isBlank()) {
            try {
                var fromInstant = java.time.LocalDate.parse(fromStr.trim()).atStartOfDay(zone).toInstant();
                sessionSql.append("AND s.opened_at >= ? ");
                params.add(java.sql.Timestamp.from(fromInstant));
            } catch (Exception ignored) {}
        }
        if (toStr != null && !toStr.isBlank()) {
            try {
                var toInstant = java.time.LocalDate.parse(toStr.trim()).plusDays(1).atStartOfDay(zone).toInstant();
                sessionSql.append("AND s.opened_at < ? ");
                params.add(java.sql.Timestamp.from(toInstant));
            } catch (Exception ignored) {}
        }
        sessionSql.append("ORDER BY s.opened_at ASC, s.id ASC");

        record ReportSessionRow(
                long id,
                long classId,
                String classCode,
                String title,
                Instant openedAt,
                Instant closedAt,
                long classStudentCount
        ) {}

        List<ReportSessionRow> sessions = jdbc.query(sessionSql.toString(), (rs, rowNum) -> {
            var closedTs = rs.getTimestamp("closed_at");
            return new ReportSessionRow(
                    rs.getLong("id"),
                    rs.getLong("class_id"),
                    rs.getString("class_code"),
                    rs.getString("title"),
                    rs.getTimestamp("opened_at").toInstant(),
                    closedTs == null ? null : closedTs.toInstant(),
                    rs.getLong("class_student_count")
            );
        }, params.toArray());

        List<ReportController.SessionBar> sessionBars = new java.util.ArrayList<>();
        List<ReportController.ReportRecord> allRecords = new java.util.ArrayList<>();

        long sumPresent = 0;
        long sumLate = 0;
        long sumAbsent = 0;
        long sumPending = 0;
        long expectedTotal = 0;
        long openSessions = 0;
        long closedSessions = 0;

        for (ReportSessionRow s : sessions) {
            List<ReportController.ReportRecord> records = jdbc.query(
                    "SELECT r.id, st.student_code, st.full_name, c.class_code, sess.title as session_title, " +
                    "r.recorded_at, r.status, r.cosine " +
                    "FROM attendance_records r " +
                    "JOIN students st ON st.id = r.student_id " +
                    "JOIN attendance_sessions sess ON sess.id = r.session_id " +
                    "JOIN classes c ON c.id = sess.class_id " +
                    "WHERE r.session_id = ? " +
                    "AND EXISTS (SELECT 1 FROM class_students cs WHERE cs.class_id = sess.class_id AND cs.student_id = r.student_id) " +
                    "ORDER BY r.recorded_at ASC",
                    (rs, rIdx) -> {
                        double cos = rs.getDouble("cosine");
                        String method = (cos >= 0.9999) ? "Thủ công" : "Nhận diện khuôn mặt";
                        return new ReportController.ReportRecord(
                                rs.getLong("id"),
                                rs.getString("student_code"),
                                rs.getString("full_name"),
                                rs.getString("class_code"),
                                rs.getString("session_title"),
                                rs.getTimestamp("recorded_at").toInstant(),
                                rs.getString("status"),
                                cos,
                                method
                        );
                    },
                    s.id()
            );

            long sessionTotalStudents = s.classStudentCount();
            boolean isClosed = s.closedAt() != null;
            if (isClosed) {
                closedSessions++;
            } else {
                openSessions++;
            }

            long pCount = records.stream().filter(r -> "PRESENT".equalsIgnoreCase(r.status())).count();
            long lCount = records.stream().filter(r -> "LATE".equalsIgnoreCase(r.status())).count();
            long attended = pCount + lCount;
            long unrecorded = Math.max(0L, sessionTotalStudents - attended);
            long sessionAbsent = isClosed ? unrecorded : 0L;
            long sessionPending = isClosed ? 0L : unrecorded;

            sumPresent += pCount;
            sumLate += lCount;
            sumAbsent += sessionAbsent;
            sumPending += sessionPending;
            expectedTotal += sessionTotalStudents;
            allRecords.addAll(records);

            double rate = sessionTotalStudents > 0 ? (attended * 100.0 / sessionTotalStudents) : 0.0;
            rate = Math.min(100.0, Math.round(rate * 10.0) / 10.0);

            sessionBars.add(new ReportController.SessionBar(
                    s.id(),
                    s.title(),
                    s.classCode(),
                    s.openedAt(),
                    s.closedAt(),
                    isClosed,
                    pCount,
                    lCount,
                    sessionAbsent,
                    sessionPending,
                    sessionTotalStudents,
                    rate
            ));
        }

        int sessionCount = sessions.size();
        double avgPresent = sessionCount > 0 ? (double) sumPresent / sessionCount : 0.0;
        avgPresent = Math.round(avgPresent * 10.0) / 10.0;

        double presentRate = expectedTotal > 0 ? (sumPresent * 100.0 / expectedTotal) : 0.0;
        double lateRate = expectedTotal > 0 ? (sumLate * 100.0 / expectedTotal) : 0.0;
        double absentRate = expectedTotal > 0 ? (sumAbsent * 100.0 / expectedTotal) : 0.0;
        double pendingRate = expectedTotal > 0 ? (sumPending * 100.0 / expectedTotal) : 0.0;

        presentRate = Math.round(presentRate * 10.0) / 10.0;
        lateRate = Math.round(lateRate * 10.0) / 10.0;
        absentRate = Math.round(absentRate * 10.0) / 10.0;
        pendingRate = Math.round(pendingRate * 10.0) / 10.0;

        return new ReportController.AttendanceReport(
                totalStudents,
                avgPresent,
                sumLate,
                sumAbsent,
                sumPending,
                openSessions,
                closedSessions,
                presentRate,
                lateRate,
                absentRate,
                pendingRate,
                sessionBars,
                allRecords
        );
    }
}
