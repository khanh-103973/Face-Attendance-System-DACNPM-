package com.faceattendance.school;
import jakarta.persistence.*;

@Entity @Table(name = "classes")
public class SchoolClass {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
    @Column(name = "class_code", nullable = false, unique = true, length = 50) String classCode;
    @Column(nullable = false, length = 150) String name;
    protected SchoolClass() {}
    SchoolClass(String code, String name) { classCode = code; this.name = name; }
}
