package com.faceattendance;
import com.faceattendance.attendance.AiClient;
import com.faceattendance.auth.UserStore;
import com.faceattendance.school.SchoolService;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.password=unused-test", "spring.flyway.enabled=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration",
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/test_only",
        "app.jwt.secret=dGVzdC1vbmx5LXNlY3JldC1rZXktMzItYnl0ZXMtbG9uZy0=",
        "app.bootstrap.admin-password="
})
class SchoolHttpTest {
    @Autowired TestRestTemplate http;
    @Autowired PasswordEncoder passwords;
    @MockitoBean UserStore users;
    @MockitoBean SchoolService school;
    @MockitoBean AiClient ai;

    HttpHeaders login(String role) {
        when(users.find("testuser")).thenReturn(Optional.of(new UserStore.Account(1, "testuser", passwords.encode("test-password-only"), role, true)));
        var result = http.postForEntity("/api/auth/login", Map.of("username", "testuser", "password", "test-password-only"), Map.class);
        var headers = new HttpHeaders();
        headers.setBearerAuth((String)result.getBody().get("access_token"));
        return headers;
    }
    @Test void anonymousAndTeacherCannotManageStudents() {
        assertEquals(401, http.getForEntity("/api/students", String.class).getStatusCode().value());
        var headers = login("TEACHER");
        assertEquals(403, http.exchange("/api/students", HttpMethod.POST,
                new HttpEntity<>(Map.of("studentCode", "SV999", "fullName", "Test"), headers), String.class).getStatusCode().value());
        verifyNoInteractions(school);
    }
    @Test void adminCanCreateStudentAndInvalidInputNeverReachesService() {
        var headers = login("ADMIN");
        when(school.addStudent("SV001", "Test Student")).thenReturn(new SchoolService.StudentView(1, "SV001", "Test Student"));
        var response = http.exchange("/api/students", HttpMethod.POST,
                new HttpEntity<>(Map.of("studentCode", "SV001", "fullName", "Test Student"), headers), String.class);
        assertEquals(201, response.getStatusCode().value());
        assertTrue(response.getBody().contains("SV001"));
        clearInvocations(school);
        response = http.exchange("/api/students", HttpMethod.POST,
                new HttpEntity<>(Map.of("studentCode", "../bad", "fullName", " "), headers), String.class);
        assertEquals(400, response.getStatusCode().value());
        verifyNoInteractions(school);
    }
}
