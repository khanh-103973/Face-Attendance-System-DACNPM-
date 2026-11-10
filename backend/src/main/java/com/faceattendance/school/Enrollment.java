package com.faceattendance.school;
import jakarta.persistence.*;

@Entity @Table(name = "class_students", uniqueConstraints = @UniqueConstraint(columnNames = {"class_id", "student_id"}))
public class Enrollment {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(name = "class_id", nullable = false) Long classId;
    @Column(name = "student_id", nullable = false) Long studentId;
    protected Enrollment() {}
    Enrollment(long classId, long studentId) { this.classId = classId; this.studentId = studentId; }
}
