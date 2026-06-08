package com.foodhub.auth.security;

// ============================================================================
// TODO (YOU CODE THIS) — JWT helper
// ----------------------------------------------------------------------------
// Lớp này tạo và xác thực JWT. Bạn tự viết, dùng thư viện jjwt đã thêm trong pom.
// Cần 2 method chính:
//   - String generateToken(String email, String role)  -> ký token, set expiration
//   - String validateAndGetSubject(String token)        -> verify chữ ký, trả về email
// Đọc secret và expiration từ application.yml qua @Value("${jwt.secret}") ...
//
// PRE-READ trước khi code (hỏi ở chat app):
//   - JWT gồm 3 phần gì? Phần nào được ký, phần nào ai cũng đọc được?
//   - Vì sao KHÔNG để dữ liệu nhạy cảm trong payload của JWT?
//   - Stateless auth khác session-based ở chỗ nào? Liên quan gì tới microservices?
// ============================================================================
public class JwtUtil {
    // your token methods here
}
