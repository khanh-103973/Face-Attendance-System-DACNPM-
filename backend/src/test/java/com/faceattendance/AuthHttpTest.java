package com.faceattendance;

import com.faceattendance.auth.UserStore;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
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
class AuthHttpTest {
    @Autowired TestRestTemplate http;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtEncoder encoder;
    @MockitoBean UserStore users;
    @MockitoBean com.faceattendance.school.SchoolService school;

    @BeforeEach void setup() {
        when(users.find("admin")).thenReturn(Optional.of(new UserStore.Account(
                1, "admin", passwords.encode("test-password-only"), "ADMIN", true)));
        when(users.find("teacher")).thenReturn(Optional.of(new UserStore.Account(
                2, "teacher", passwords.encode("test-password-only"), "TEACHER", true)));
    }

    String login(String username) {
        var response = http.postForEntity("/api/auth/login",
                Map.of("username", username, "password", "test-password-only"), Map.class);
        assertEquals(200, response.getStatusCode().value());
        return (String) response.getBody().get("access_token");
    }

    ResponseEntity<String> get(String path, String token) {
        var headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return http.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    @Test void loginMeAndAdminRole() {
        String token = login("admin");
        var me = get("/api/auth/me", token);
        assertEquals(200, me.getStatusCode().value());
        assertTrue(me.getBody().contains("ADMIN"));
        assertFalse(me.getBody().contains("password"));
        assertEquals(200, get("/api/admin/check", token).getStatusCode().value());
    }

    @Test void teacherCannotAccessAdmin() {
        String token = login("teacher");
        assertEquals(200, get("/api/auth/me", token).getStatusCode().value());
        assertEquals(403, get("/api/admin/check", token).getStatusCode().value());
    }

    @Test void invalidCredentialsAndMissingToken() {
        var response = http.postForEntity("/api/auth/login",
                Map.of("username", "admin", "password", "incorrect"), String.class);
        assertEquals(401, response.getStatusCode().value());
        assertEquals(401, http.getForEntity("/api/auth/me", String.class).getStatusCode().value());
        assertEquals(401, get("/api/auth/me", "broken.token.value").getStatusCode().value());
        var badInput = http.postForEntity("/api/auth/login", Map.of("username", "admin"), String.class);
        assertEquals(400, badInput.getStatusCode().value());
    }

    @Test void expiredTokenAndDisabledAccountRejected() {
        var claims = JwtClaimsSet.builder().issuer("face-attendance-backend").subject("admin")
                .issuedAt(Instant.now().minusSeconds(500)).expiresAt(Instant.now().minusSeconds(300)).build();
        String expired = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        assertEquals(401, get("/api/auth/me", expired).getStatusCode().value());
        String token = login("admin");
        when(users.find("admin")).thenReturn(Optional.of(new UserStore.Account(1, "admin", "unused", "ADMIN", false)));
        assertEquals(401, get("/api/auth/me", token).getStatusCode().value());
    }
}
