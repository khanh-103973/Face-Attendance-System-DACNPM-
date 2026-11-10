package com.faceattendance.attendance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AiClient {
    private final RestClient http;
    private final String key;
    public AiClient(@Value("${app.ai.base-url}") String url, @Value("${app.ai.api-key:}") String key) {
        this.key = key;
        var transport = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(transport);
        factory.setReadTimeout(Duration.ofSeconds(30));
        this.http = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    public Result recognize(byte[] image, String contentType) {
        if (key.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI_API_KEY not configured");
        try {
            Result result = http.post().uri("/recognize").header("X-API-Key", key)
                    .contentType(MediaType.parseMediaType(contentType)).body(image).retrieve().body(Result.class);
            validate(result);
            return result;
        } catch (HttpStatusCodeException error) {
            int code = error.getStatusCode().value();
            if (code == 400 || code == 413 || code == 415) {
                throw new ResponseStatusException(HttpStatus.valueOf(code), "Image rejected by AI Service");
            }
            throw new ResponseStatusException(code == 503 ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY,
                    "AI Service could not process request");
        } catch (ResourceAccessException error) {
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "AI Service connection failed or timed out");
        } catch (RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid AI Service response");
        }
    }

    static void validate(Result result) {
        if (result == null || result.status() == null || !Set.of("matched", "unknown", "no_face", "multiple_faces", "low_quality", "gallery_empty").contains(result.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid AI Service response");
        }
        if (result.status().equals("matched") && (result.faceCount() == null || result.faceCount() != 1
                || result.studentCode() == null || !result.studentCode().matches("[A-Za-z0-9][A-Za-z0-9_-]{0,49}")
                || result.cosine() == null || !Double.isFinite(result.cosine()) || Math.abs(result.cosine()) > 1
                || result.threshold() == null || !Double.isFinite(result.threshold()) || Math.abs(result.threshold()) > 1
                || result.cosine() < result.threshold())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Inconsistent matched AI result");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Result(String status, @JsonProperty("student_id") String studentCode,
                         Double cosine, @JsonProperty("face_count") Integer faceCount,
                         Double threshold, @JsonProperty("threshold_calibrated") Boolean calibrated) {}

    public static final class RegisterImage {
        @JsonProperty("content_type")
        private String contentType;
        @JsonProperty("data_base64")
        private String dataBase64;

        public RegisterImage() {}

        public RegisterImage(String contentType, String dataBase64) {
            this.contentType = contentType;
            this.dataBase64 = dataBase64;
        }

        @JsonProperty("content_type")
        public String contentType() { return contentType; }

        @JsonProperty("data_base64")
        public String dataBase64() { return dataBase64; }

        @com.fasterxml.jackson.annotation.JsonSetter("content_type")
        public void setContentType(String contentType) { this.contentType = contentType; }

        @com.fasterxml.jackson.annotation.JsonSetter("contentType")
        public void setContentTypeCamel(String contentType) { this.contentType = contentType; }

        @com.fasterxml.jackson.annotation.JsonSetter("data_base64")
        public void setDataBase64(String dataBase64) { this.dataBase64 = dataBase64; }

        @com.fasterxml.jackson.annotation.JsonSetter("dataBase64")
        public void setDataBase64Camel(String dataBase64) { this.dataBase64 = dataBase64; }
    }

    public record RegisterPayload(@JsonProperty("student_id") String studentId,
                                  boolean consent,
                                  List<RegisterImage> images) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RegisterResult(String status,
                                 @JsonProperty("student_id") String studentCode,
                                 Integer samples,
                                 Integer dimensions) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RegisteredList(List<String> identities) {}

    public List<String> listRegistered() {
        if (key.isBlank()) return List.of();
        try {
            var res = http.get().uri("/registrations")
                    .header("X-API-Key", key)
                    .retrieve()
                    .body(RegisteredList.class);
            return res != null && res.identities() != null ? res.identities() : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    public RegisterResult register(String studentCode, boolean consent, List<RegisterImage> images) {
        if (key.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI_API_KEY not configured");
        try {
            var payload = new RegisterPayload(studentCode, consent, images);
            return http.post().uri("/registrations")
                    .header("X-API-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(RegisterResult.class);
        } catch (HttpStatusCodeException error) {
            int code = error.getStatusCode().value();
            if (code == 409) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Student already registered in AI gallery");
            }
            if (code == 413) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Registration payload too large");
            }
            if (code == 422) {
                String detail = error.getResponseBodyAsString();
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        detail != null && !detail.isBlank() ? detail : "Invalid samples or face quality check failed");
            }
            throw new ResponseStatusException(code == 503 ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY,
                    "AI Service could not process registration");
        } catch (ResourceAccessException error) {
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "AI Service connection timed out");
        } catch (RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid AI Service response");
        }
    }
}
