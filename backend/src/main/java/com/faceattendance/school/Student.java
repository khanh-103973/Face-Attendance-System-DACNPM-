package com.faceattendance.school;
import jakarta.persistence.*;

@Entity @Table(name = "students")
public class Student {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(name = "student_code", nullable = false, unique = true, length = 50) String studentCode;
    @Column(name = "full_name", nullable = false, length = 150) String fullName;
    protected Student() {}
    Student(String code, String name) { studentCode = code; fullName = name; }
}
