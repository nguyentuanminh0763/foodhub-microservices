package com.foodhub.auth.model;

// ============================================================================
// TODO (YOU CODE THIS) — User entity
// ----------------------------------------------------------------------------
// Đây là entity ánh xạ sang bảng users trong MySQL. Bạn tự khai báo.
// Gợi ý các field cần có:
//   - id (Long, @Id @GeneratedValue)
//   - email (unique, dùng để đăng nhập)
//   - password (LƯU HASH, không bao giờ lưu plaintext - dùng BCrypt ở Service)
//   - role (enum: CUSTOMER / RESTAURANT / ADMIN)
//   - createdAt
// Annotation cần tìm hiểu: @Entity, @Table, @Id, @GeneratedValue, @Column(unique=true)
// Câu hỏi tự kiểm tra: tại sao password phải hash mà không mã hoá 2 chiều?
// ============================================================================
public class User {
    // your fields + getters/setters here
}
