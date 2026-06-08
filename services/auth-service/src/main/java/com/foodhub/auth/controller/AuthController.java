package com.foodhub.auth.controller;

import org.springframework.web.bind.annotation.*;

// ============================================================================
// TODO (YOU CODE THIS) — REST endpoints
// ----------------------------------------------------------------------------
// Controller chỉ nhận request, gọi AuthService, trả response. KHÔNG để logic ở đây.
// Cần các endpoint:
//   POST /api/auth/register   body: { email, password, role }  -> 201 + message
//   POST /api/auth/login      body: { email, password }        -> 200 + { token }
// Tạo thêm DTO (record RegisterRequest, LoginRequest, AuthResponse) cho gọn.
// Annotation: @RestController, @RequestMapping("/api/auth"), @PostMapping, @RequestBody
//
// Lưu ý kiến trúc: path bắt đầu bằng /api/auth/** để khớp route ở Gateway.
// ============================================================================
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // PLUMBING - health check để docker-compose / gateway biết service sống.
    @GetMapping("/health")
    public String health() {
        return "auth-service OK";
    }

    // your /register and /login endpoints here
}
