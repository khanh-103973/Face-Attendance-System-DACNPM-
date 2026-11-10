package com.faceattendance.attendance;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/attendance-sessions")
public class AttendanceController {
    private final AttendanceStore store;
    private final AttendanceService service;
    public AttendanceController(AttendanceStore store, AttendanceService service) { this.store = store; this.service = service; }
    public record Create(@Positive long classId, @NotBlank @Size(max = 150) String title,
                         @NotNull @Min(0) @Max(180) Integer lateAfterMinutes) {}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public AttendanceStore.Session create(@Valid @RequestBody Create input, @AuthenticationPrincipal Jwt jwt) {
        return store.create(input.classId(), input.title(), input.lateAfterMinutes(), jwt.getSubject());
    }
    @GetMapping public AttendanceStore.Page<AttendanceStore.Session> list(
            @RequestParam(required = false) Long classId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (classId != null && classId > 0) {
            return store.sessions(classId, page, size);
        }
        return store.allSessions(page, size);
    }
    @GetMapping("/{id}") public AttendanceStore.Session get(@PathVariable long id) { return store.get(id); }
    @PostMapping("/{id}/close") public AttendanceStore.Session close(@PathVariable long id) { return store.close(id); }
    @PostMapping("/{id}/reopen") public AttendanceStore.Session reopen(@PathVariable long id) { return store.reopen(id); }
    public record ManualRecordInput(@NotBlank String studentCode, String status) {}
    @PostMapping("/{id}/manual-record")
    public AttendanceStore.Outcome manualRecord(@PathVariable long id, @Valid @RequestBody ManualRecordInput input) {
        return store.manualRecord(id, input.studentCode().strip(), input.status());
    }
    @GetMapping("/{id}/records") public AttendanceStore.Page<AttendanceStore.Record> records(@PathVariable long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return store.records(id, page, size); }
    @PostMapping("/{id}/recognize")
    public AttendanceStore.Outcome recognize(@PathVariable long id, HttpServletRequest request) throws IOException {
        String type = request.getContentType() == null ? "" : request.getContentType().split(";")[0].strip().toLowerCase(Locale.ROOT);
        if (!type.equals("image/jpeg") && !type.equals("image/png")) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Send raw JPEG/PNG bytes");
        int max = 5 * 1024 * 1024;
        if (request.getContentLengthLong() > max) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        byte[] image = request.getInputStream().readNBytes(max + 1);
        if (image.length > max) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
        if (image.length == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty image");
        return service.recognize(id, image, type);
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.status(409).body(Map.of("error", "An open session or referenced record already exists"));
    }
}
