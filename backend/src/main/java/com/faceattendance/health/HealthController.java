package com.faceattendance.health;

import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/live")
    public Health live() {
        return new Health("ok", "not_checked");
    }

    @GetMapping
    public ResponseEntity<Health> ready() {
        try {
            Integer result = jdbc.queryForObject("SELECT 1", Integer.class);
            if (Integer.valueOf(1).equals(result)) {
                return ResponseEntity.ok(new Health("ok", "up"));
            }
        } catch (DataAccessException ignored) {
            // The response must not reveal credentials, connection URLs or SQL errors.
        }
        return ResponseEntity.status(503).body(new Health("unavailable", "down"));
    }

    public record Health(String status, String database) {}
}
