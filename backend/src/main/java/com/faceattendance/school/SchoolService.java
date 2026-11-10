package com.faceattendance.school;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Transactional
public class SchoolService {
    private final StudentRepository students;
    private final ClassRepository classes;
    private final EnrollmentRepository enrollments;
    public SchoolService(StudentRepository students, ClassRepository classes, EnrollmentRepository enrollments) {
        this.students = students; this.classes = classes; this.enrollments = enrollments;
    }
    public record StudentView(long id, String studentCode, String fullName) {}
    public record ClassView(long id, String classCode, String name) {}
    public record PageView<T>(List<T> items, int page, int size, long totalElements) {}
    static StudentView view(Student student) { return new StudentView(student.id, student.studentCode, student.fullName); }
    static ClassView view(SchoolClass item) { return new ClassView(item.id, item.classCode, item.name); }
    private Student student(long id) { return students.findById(id).orElseThrow(() -> missing("Student")); }
    private SchoolClass schoolClass(long id) { return classes.findById(id).orElseThrow(() -> missing("Class")); }
    private static ResponseStatusException missing(String type) { return new ResponseStatusException(HttpStatus.NOT_FOUND, type + " not found"); }
    private static ResponseStatusException conflict() { return new ResponseStatusException(HttpStatus.CONFLICT, "Remove class membership before deleting"); }
    static PageRequest page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or size");
        return PageRequest.of(page, size, Sort.by("id"));
    }
    @Transactional(readOnly = true)
    public PageView<StudentView> students(int page, int size) {
        var result = students.findAll(page(page, size));
        return new PageView<>(result.map(SchoolService::view).getContent(), page, size, result.getTotalElements());
    }
    @Transactional(readOnly = true) public StudentView getStudent(long id) { return view(student(id)); }
    public StudentView addStudent(String code, String name) {
        String canonical = code.toUpperCase(Locale.ROOT);
        if (canonical.matches("CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reserved student code");
        }
        return view(students.saveAndFlush(new Student(canonical, name.strip())));
    }
    public StudentView updateStudent(long id, String name) {
        var item = student(id); item.fullName = name.strip(); return view(students.saveAndFlush(item));
    }
    public void deleteStudent(long id) {
        var item = student(id);
        if (enrollments.existsByStudentId(id)) throw conflict();
        students.delete(item); students.flush();
    }
    @Transactional(readOnly = true)
    public PageView<ClassView> classes(int page, int size) {
        var result = classes.findAll(page(page, size));
        return new PageView<>(result.map(SchoolService::view).getContent(), page, size, result.getTotalElements());
    }
    @Transactional(readOnly = true) public ClassView getClass(long id) { return view(schoolClass(id)); }
    public ClassView addClass(String code, String name) { return view(classes.saveAndFlush(new SchoolClass(code.toUpperCase(Locale.ROOT), name.strip()))); }
    public ClassView updateClass(long id, String name) {
        var item = schoolClass(id); item.name = name.strip(); return view(classes.saveAndFlush(item));
    }
    public void deleteClass(long id) {
        var item = schoolClass(id);
        if (enrollments.existsByClassId(id)) throw conflict();
        classes.delete(item); classes.flush();
    }
    public void enroll(long classId, long studentId) {
        schoolClass(classId); student(studentId);
        if (enrollments.findByClassIdAndStudentId(classId, studentId).isEmpty()) {
            enrollments.saveAndFlush(new Enrollment(classId, studentId));
        }
    }
    public void unenroll(long classId, long studentId) {
        schoolClass(classId); student(studentId);
        enrollments.findByClassIdAndStudentId(classId, studentId).ifPresent(enrollments::delete);
        enrollments.flush();
    }
    @Transactional(readOnly = true)
    public PageView<StudentView> members(long classId, int page, int size) {
        schoolClass(classId);
        var result = enrollments.findByClassId(classId, page(page, size));
        var ids = result.getContent().stream().map(item -> item.studentId).toList();
        Map<Long, Student> indexed = students.findAllById(ids).stream().collect(Collectors.toMap(item -> item.id, item -> item));
        return new PageView<>(ids.stream().map(id -> view(indexed.get(id))).toList(), page, size, result.getTotalElements());
    }
}
