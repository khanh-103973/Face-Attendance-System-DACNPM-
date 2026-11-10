package com.faceattendance.school;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchoolServiceTest {
    StudentRepository students = mock(StudentRepository.class);
    ClassRepository classes = mock(ClassRepository.class);
    EnrollmentRepository enrollments = mock(EnrollmentRepository.class);
    SchoolService service = new SchoolService(students, classes, enrollments);

    @Test void missingStudentIs404() {
        when(students.findById(4L)).thenReturn(Optional.empty());
        var error = assertThrows(ResponseStatusException.class, () -> service.getStudent(4));
        assertEquals(404, error.getStatusCode().value());
    }
    @Test void memberCannotBeDeleted() {
        when(students.findById(1L)).thenReturn(Optional.of(new Student("SV001", "Test")));
        when(enrollments.existsByStudentId(1)).thenReturn(true);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.deleteStudent(1)).getStatusCode().value());
        verify(students, never()).delete(any());
    }
    @Test void enrollmentRequiresBothRecordsAndIsIdempotent() {
        when(students.findById(1L)).thenReturn(Optional.of(new Student("SV001", "Test")));
        when(classes.findById(2L)).thenReturn(Optional.of(new SchoolClass("C1", "Class")));
        when(enrollments.findByClassIdAndStudentId(2, 1)).thenReturn(Optional.of(new Enrollment(2, 1)));
        service.enroll(2, 1);
        verify(enrollments, never()).saveAndFlush(any());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.enroll(9, 1)).getStatusCode().value());
    }
    @Test void pageLimitsAndReservedCodes() {
        assertThrows(ResponseStatusException.class, () -> service.students(0, 101));
        assertThrows(ResponseStatusException.class, () -> service.students(-1, 10));
        assertThrows(ResponseStatusException.class, () -> service.addStudent("con", "Test"));
    }
}
