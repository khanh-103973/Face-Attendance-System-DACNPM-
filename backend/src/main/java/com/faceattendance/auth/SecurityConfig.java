package com.faceattendance.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.util.Base64;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.BearerTokenErrors;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {
    public static final String ISSUER = "face-attendance-backend";

    @Bean
    SecretKey jwtKey(@Value("${app.jwt.secret}") String encoded) {
        byte[] key = Base64.getDecoder().decode(encoded);
        if (key.length < 32) throw new IllegalArgumentException("JWT key needs at least 32 random bytes");
        return new SecretKeySpec(key, "HmacSHA256");
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean JwtEncoder jwtEncoder(SecretKey key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder jwtDecoder(SecretKey key) {
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
        return decoder;
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, UserStore users) throws Exception {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            var account = users.find(jwt.getSubject()).filter(UserStore.Account::enabled)
                    .orElseThrow(() -> new OAuth2AuthenticationException(BearerTokenErrors.invalidToken("Account unavailable")));
            return List.of(new SimpleGrantedAuthority("ROLE_" + account.role()));
        });
        return http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/health/live").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/attendance-sessions", "/api/attendance-sessions/**").hasAnyRole("ADMIN", "TEACHER")
                        .requestMatchers("/api/classes", "/api/classes/**").hasAnyRole("ADMIN", "TEACHER")
                        .requestMatchers("/api/reports", "/api/reports/**").hasAnyRole("ADMIN", "TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/students", "/api/students/**").hasAnyRole("ADMIN", "TEACHER")
                        .requestMatchers("/api/students", "/api/students/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .anyRequest().denyAll())
                .oauth2ResourceServer(resource -> resource.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)))
                .build();
    }
}
