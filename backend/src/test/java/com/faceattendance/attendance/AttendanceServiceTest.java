package com.faceattendance.attendance;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AttendanceServiceTest {
    AttendanceStore store = mock(AttendanceStore.class);
    AiClient ai = mock(AiClient.class);
    AttendanceService service = new AttendanceService(store, ai);
    byte[] image = new byte[]{1};
    @Test void unknownNeverWritesAttendance() {
        when(ai.recognize(image, "image/jpeg")).thenReturn(new AiClient.Result("unknown", null, 0.2, 1, 0.5, false));
        assertFalse(service.recognize(1, image, "image/jpeg").attendanceRecorded());
        verify(store, never()).record(anyLong(), anyString(), anyDouble());
    }
    @Test void closedSessionNeverCallsAi() {
        when(store.requireOpen(1)).thenThrow(new ResponseStatusException(HttpStatus.CONFLICT));
        assertThrows(ResponseStatusException.class, () -> service.recognize(1, image, "image/jpeg"));
        verifyNoInteractions(ai);
    }
    @Test void matchedStudentMustBeCheckedByTransactionalStore() {
        when(ai.recognize(image, "image/jpeg")).thenReturn(new AiClient.Result("matched", "SV001", 0.88, 1, 0.5, false));
        var expected = new AttendanceStore.Outcome("student_not_in_class", false, null, 0.88, true);
        when(store.record(1, "SV001", 0.88)).thenReturn(expected);
        assertEquals(expected, service.recognize(1, image, "image/jpeg"));
    }
    @Test void aiFailureAndMalformedMatchNeverWrite() {
        when(ai.recognize(image, "image/jpeg")).thenThrow(new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT));
        assertThrows(ResponseStatusException.class, () -> service.recognize(1, image, "image/jpeg"));
        doReturn(new AiClient.Result("matched", "SV001", 0.2, 2, 0.5, false)).when(ai).recognize(image, "image/jpeg");
        assertThrows(ResponseStatusException.class, () -> service.recognize(1, image, "image/jpeg"));
        verify(store, never()).record(anyLong(), anyString(), anyDouble());
    }
}
