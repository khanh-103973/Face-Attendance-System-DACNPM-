package com.faceattendance.attendance;
import org.springframework.stereotype.Service;

@Service
public class AttendanceService {
    private final AttendanceStore store;
    private final AiClient ai;
    public AttendanceService(AttendanceStore store, AiClient ai) { this.store = store; this.ai = ai; }
    public AttendanceStore.Outcome recognize(long sessionId, byte[] image, String contentType) {
        store.requireOpen(sessionId);
        var result = ai.recognize(image, contentType);
        AiClient.validate(result);
        // No database transaction or session lock is held while calling the AI service.
        if (!result.status().equals("matched")) {
            store.requireOpen(sessionId);
            return new AttendanceStore.Outcome(result.status(), false, null, result.cosine(), true);
        }
        return store.record(sessionId, result.studentCode(), result.cosine());
    }
}
