package com.faceattendance.school;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    boolean existsByStudentId(long studentId);
    boolean existsByClassId(long classId);
    Optional<Enrollment> findByClassIdAndStudentId(long classId, long studentId);
    Page<Enrollment> findByClassId(long classId, Pageable pageable);
}
