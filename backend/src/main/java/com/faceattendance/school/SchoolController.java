package com.faceattendance.school;

import com.faceattendance.attendance.AiClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api")
public class SchoolController {
    private final SchoolService service;
    private final AiClient aiClient;
    public SchoolController(SchoolService service, AiClient aiClient) {
        this.service = service;
        this.aiClient = aiClient;
    }
    public record StudentInput(@NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_-]{0,49}") String studentCode,
                               @NotBlank @Size(max = 150) String fullName) {}
    public record ClassInput(@NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_-]{0,49}") String classCode,
                             @NotBlank @Size(max = 150) String name) {}
    public record StudentUpdate(@NotBlank @Size(max = 150) String fullName) {}
    public record ClassUpdate(@NotBlank @Size(max = 150) String name) {}
    public record FaceRegisterInput(
            @NotNull Boolean consent,
            @NotEmpty @Size(min = 15, max = 25) List<AiClient.RegisterImage> images) {}

    @GetMapping("/students") public SchoolService.PageView<SchoolService.StudentView> students(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return service.students(page, size); }
    @GetMapping("/students/registered-faces")
    public List<String> registeredFaces() {
        return aiClient.listRegistered();
    }
    @GetMapping("/students/{id}") public SchoolService.StudentView student(@PathVariable long id) { return service.getStudent(id); }
    @PostMapping("/students") @ResponseStatus(HttpStatus.CREATED)
    public SchoolService.StudentView addStudent(@Valid @RequestBody StudentInput input) { return service.addStudent(input.studentCode(), input.fullName()); }
    @PostMapping("/students/{id}/register-face")
    public AiClient.RegisterResult registerFace(@PathVariable long id, @Valid @RequestBody FaceRegisterInput input) {
        if (!Boolean.TRUE.equals(input.consent())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Participant consent is required");
        }
        var student = service.getStudent(id);
        return aiClient.register(student.studentCode(), input.consent(), input.images());
    }
    @PutMapping("/students/{id}") public SchoolService.StudentView updateStudent(@PathVariable long id, @Valid @RequestBody StudentUpdate input) { return service.updateStudent(id, input.fullName()); }
    @DeleteMapping("/students/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStudent(@PathVariable long id) { service.deleteStudent(id); }

    @GetMapping("/classes") public SchoolService.PageView<SchoolService.ClassView> classes(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) { return service.classes(page, size); }
    @GetMapping("/classes/{id}") public SchoolService.ClassView schoolClass(@PathVariable long id) { return service.getClass(id); }
    @PostMapping("/classes") @ResponseStatus(HttpStatus.CREATED)
    public SchoolService.ClassView addClass(@Valid @RequestBody ClassInput input) { return service.addClass(input.classCode(), input.name()); }
    @PutMapping("/classes/{id}") public SchoolService.ClassView updateClass(@PathVariable long id, @Valid @RequestBody ClassUpdate input) { return service.updateClass(id, input.name()); }
    @DeleteMapping("/classes/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteClass(@PathVariable long id) { service.deleteClass(id); }

    @GetMapping("/classes/{classId}/students") public SchoolService.PageView<SchoolService.StudentView> members(
            @PathVariable long classId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) { return service.members(classId, page, size); }
    @PutMapping("/classes/{classId}/students/{studentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void enroll(@PathVariable long classId, @PathVariable long studentId) { service.enroll(classId, studentId); }
    @DeleteMapping("/classes/{classId}/students/{studentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unenroll(@PathVariable long classId, @PathVariable long studentId) { service.unenroll(classId, studentId); }
}
