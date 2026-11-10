package com.faceattendance.auth;

import java.nio.charset.StandardCharsets;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminBootstrap implements ApplicationRunner {
    private final UserStore users;
    private final PasswordEncoder passwords;
    private final String initialPassword;
    public AdminBootstrap(UserStore users, PasswordEncoder passwords,
                          @Value("${app.bootstrap.admin-password:}") String initialPassword) {
        this.users = users; this.passwords = passwords; this.initialPassword = initialPassword;
    }
    @Override public void run(ApplicationArguments args) {
        if (initialPassword.isEmpty()) return;
        int length = initialPassword.getBytes(StandardCharsets.UTF_8).length;
        if (initialPassword.length() < 10 || length > 72) {
            throw new IllegalArgumentException("Initial admin password must have at least 10 characters and at most 72 UTF-8 bytes");
        }
        users.createAdmin(passwords.encode(initialPassword));
    }
}
