package com.foodhub.auth.service;

// ============================================================================
// TODO (YOU CODE THIS) — Business logic
// ----------------------------------------------------------------------------
// Đây là nơi đặt logic nghiệp vụ (KHÔNG để trong Controller).
// register(email, password, role):
//   1. kiểm tra email đã tồn tại chưa -> nếu có thì ném lỗi
//   2. hash password bằng BCryptPasswordEncoder
//   3. lưu User vào DB qua repository (bạn cũng cần tạo interface UserRepository
//      extends JpaRepository<User, Long> - đây là phần Spring Data tự lo, gần như plumbing)
// login(email, password):
//   1. tìm user theo email
//   2. so khớp password với BCrypt
//   3. nếu đúng -> JwtUtil.generateToken(...) và trả về token
//
// Annotation: @Service. Inject UserRepository và JwtUtil qua constructor.
// ============================================================================
public class AuthService {
    // your register() / login() here
}
