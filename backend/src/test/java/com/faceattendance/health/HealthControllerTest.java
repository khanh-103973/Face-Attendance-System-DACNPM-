package com.faceattendance.health;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HealthControllerTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final HealthController controller = new HealthController(jdbc);

    @Test
    void livenessDoesNotQueryDatabase() {
        assertEquals("ok", controller.live().status());
        verifyNoInteractions(jdbc);
    }

    @Test
    void readinessChecksRealQueryResult() {
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        var response = controller.ready();
        assertEquals(200, response.getStatusCode().value());
        assertEquals("up", response.getBody().database());
    }

    @Test
    void readinessFailureDoesNotExposeDatabaseError() {
        when(jdbc.queryForObject("SELECT 1", Integer.class))
                .thenThrow(new DataAccessResourceFailureException("private connection details"));
        var response = controller.ready();
        assertEquals(503, response.getStatusCode().value());
        assertEquals(new HealthController.Health("unavailable", "down"), response.getBody());
    }
}
