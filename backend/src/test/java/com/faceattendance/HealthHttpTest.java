package com.faceattendance;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.password=test-only-unused",
        "spring.flyway.enabled=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration",
        "app.jwt.secret=dGVzdC1vbmx5LXNlY3JldC1rZXktMzItYnl0ZXMtbG9uZy0=",
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/test_only"
})
class HealthHttpTest {
    @Autowired TestRestTemplate http;
    @MockitoBean JdbcTemplate jdbc;
    @MockitoBean com.faceattendance.school.SchoolService school;

    @Test
    void liveAndReadyAreRoutedOverHttp() {
        assertEquals(200, http.getForEntity("/api/health/live", String.class).getStatusCode().value());
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        var response = http.getForEntity("/api/health", String.class);
        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody().contains("\"database\":\"up\""));
    }

    @Test
    void databaseFailureReturns503WithoutDetails() {
        when(jdbc.queryForObject("SELECT 1", Integer.class))
                .thenThrow(new DataAccessResourceFailureException("do-not-expose"));
        var response = http.getForEntity("/api/health", String.class);
        assertEquals(503, response.getStatusCode().value());
        assertFalse(response.getBody().contains("do-not-expose"));
    }
}
