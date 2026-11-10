package com.faceattendance.school;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = SchoolController.class)
public class SchoolErrors {
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.status(409).body(Map.of("error", "Duplicate code, membership or referenced record"));
    }
}
