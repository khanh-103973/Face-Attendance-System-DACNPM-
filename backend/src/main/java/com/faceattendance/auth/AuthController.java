package com.faceattendance.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthController {
    private final UserStore users;
    private final PasswordEncoder passwords;
    private final JwtEncoder encoder;
    private final String dummyHash;

    public AuthController(UserStore users, PasswordEncoder passwords, JwtEncoder encoder) {
        this.users = users; this.passwords = passwords; this.encoder = encoder;
        this.dummyHash = passwords.encode("unused-timing-padding");
    }

    @PostMapping("/api/auth/login")
    public Token login(@RequestBody Login request) {
        if (request.username() == null || request.password() == null
                || request.username().length() > 50 || request.password().isEmpty()
                || request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid login input");
        }
        String username = request.username().strip().toLowerCase(Locale.ROOT);
        var account = users.find(username).orElse(null);
        boolean matches = passwords.matches(request.password(), account == null ? dummyHash : account.passwordHash());
        if (account == null || !matches || !account.enabled()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(SecurityConfig.ISSUER).subject(account.username())
                .issuedAt(now).expiresAt(now.plusSeconds(900)).claim("role", account.role()).build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        String value = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new Token(value, "Bearer", 900);
    }

    @GetMapping("/api/auth/me")
    public Profile me(@AuthenticationPrincipal Jwt jwt) {
        var account = users.find(jwt.getSubject()).filter(UserStore.Account::enabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return new Profile(account.id(), account.username(), account.role());
    }

    @GetMapping("/api/admin/check")
    public Map<String, String> adminCheck() { return Map.of("status", "ok", "required_role", "ADMIN"); }

    @GetMapping("/api/admin/teachers")
    public java.util.List<UserStore.TeacherView> teachers() {
        return users.findTeachers();
    }

    public record CreateTeacherInput(String username, String password) {}

    @PostMapping("/api/admin/teachers")
    @ResponseStatus(HttpStatus.CREATED)
    public UserStore.TeacherView createTeacher(@RequestBody CreateTeacherInput request) {
        if (request.username() == null || request.password() == null
                || !request.username().strip().matches("^[a-z0-9][a-z0-9_.-]{2,49}$")
                || request.password().length() < 6
                || request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên đăng nhập cần 3-50 ký tự thường/số và mật khẩu >= 6 ký tự");
        }
        String username = request.username().strip().toLowerCase(Locale.ROOT);
        if (users.find(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tên đăng nhập đã tồn tại");
        }
        String hash = passwords.encode(request.password());
        var created = users.createTeacher(username, hash);
        return new UserStore.TeacherView(created.id(), created.username(), created.role(), created.enabled());
    }

    public record Login(String username, String password) {}
    public record Token(String access_token, String token_type, long expires_in) {}
    public record Profile(long id, String username, String role) {}
}
