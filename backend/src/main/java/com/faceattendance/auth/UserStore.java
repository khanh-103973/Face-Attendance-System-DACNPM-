package com.faceattendance.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserStore {
    private final JdbcTemplate jdbc;
    public UserStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Optional<Account> find(String username) {
        return jdbc.query("SELECT id, username, password_hash, role, enabled FROM users WHERE username = ?",
                (rs, row) -> new Account(rs.getLong("id"), rs.getString("username"),
                        rs.getString("password_hash"), rs.getString("role"), rs.getBoolean("enabled")),
                username).stream().findFirst();
    }

    public void createAdmin(String hash) {
        jdbc.update("INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'ADMIN') "
                + "ON CONFLICT (username) DO NOTHING", hash);
    }

    public Account createTeacher(String username, String hash) {
        return jdbc.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'TEACHER') RETURNING id, username, password_hash, role, enabled",
                (rs, row) -> new Account(rs.getLong("id"), rs.getString("username"),
                        rs.getString("password_hash"), rs.getString("role"), rs.getBoolean("enabled")),
                username, hash).getFirst();
    }

    public List<TeacherView> findTeachers() {
        return jdbc.query("SELECT id, username, role, enabled FROM users WHERE role = 'TEACHER' ORDER BY id DESC",
                (rs, row) -> new TeacherView(rs.getLong("id"), rs.getString("username"), rs.getString("role"), rs.getBoolean("enabled")));
    }

    public record Account(long id, String username, String passwordHash, String role, boolean enabled) {}
    public record TeacherView(long id, String username, String role, boolean enabled) {}
}
