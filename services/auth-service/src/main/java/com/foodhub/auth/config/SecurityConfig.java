package com.foodhub.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

// ============================================================================
// FILL-IN-THE-BLANK — cấu trúc đã có, bạn điền các dòng mang QUYẾT ĐỊNH.
// File này sẽ KHÔNG compile cho tới khi bạn điền hết `// FILL:`  — đó là chủ ý.
//
// Vì sao file này tồn tại: chỉ cần có spring-boot-starter-security trên classpath
// mà không khai báo SecurityFilterChain, Spring Boot bật chain mặc định -> MỌI
// request đòi authentication -> /api/auth/register trả 401. Nghịch lý: muốn đăng ký
// thì phải đã đăng nhập.
// ============================================================================
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // ------------------------------------------------------------------
    // FILL 1 — kiểu trả về của bean này.
    // AuthService của bạn đang inject `BCryptPasswordEncoder` (kiểu cụ thể).
    // Câu hỏi: nên khai báo bean trả về kiểu cụ thể hay interface PasswordEncoder?
    // Nếu mai đổi sang Argon2 thì file nào phải sửa trong mỗi trường hợp?
    // (Điền xong nhớ sửa constructor của AuthService cho khớp.)
    // ------------------------------------------------------------------
    @Bean
    public /* FILL: kiểu trả về */ passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // --------------------------------------------------------------
            // FILL 2 — CSRF.
            // CSRF protection chống lại việc trình duyệt tự động đính kèm cookie
            // vào request giả mạo. API này stateless, xác thực bằng Bearer token
            // trong header, không dùng cookie. Vậy giữ hay tắt? Vì sao?
            // Gợi ý cú pháp: .csrf(csrf -> csrf.???)
            // --------------------------------------------------------------
            // FILL: dòng csrf ở đây

            .authorizeHttpRequests(auth -> auth
                // ----------------------------------------------------------
                // FILL 3 — những path nào KHÔNG cần đăng nhập?
                // Tối thiểu: đăng ký, đăng nhập, health check.
                // Cẩn thận: mở rộng quá tay là mở toang service.
                // Gợi ý cú pháp: .requestMatchers("...").permitAll()
                // ----------------------------------------------------------
                // FILL: các dòng permitAll ở đây

                // ----------------------------------------------------------
                // FILL 4 — còn lại thì sao?
                // Câu hỏi quan trọng: vì sao dòng này phải nằm CUỐI CÙNG?
                // (thứ tự matcher trong Spring Security có ý nghĩa gì?)
                // ----------------------------------------------------------
                // FILL: .anyRequest().???
            )

            // --------------------------------------------------------------
            // FILL 5 — session policy.
            // Bạn phát JWT, không giữ session phía server. Nếu để Spring tạo
            // HttpSession cho mỗi request đã xác thực thì hỏng cái gì khi bạn
            // scale auth-service lên 3 instance sau load balancer?
            // Gợi ý: .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.???))
            // --------------------------------------------------------------
            // FILL: dòng sessionManagement ở đây

            // --------------------------------------------------------------
            // FILL 6 — form login & HTTP Basic.
            // Spring bật sẵn trang login HTML và Basic auth. Service này chỉ trả
            // JSON và không có UI. Nên làm gì với chúng, và vì sao để lại là bẩn?
            // Gợi ý: .formLogin(AbstractHttpConfigurer::disable) — cần thêm import
            // --------------------------------------------------------------
            // FILL: tắt formLogin và httpBasic ở đây
            ;

        return http.build();
    }
}

// ============================================================================
// SAU KHI ĐIỀN XONG — tự kiểm tra bằng 3 câu (đây là câu phỏng vấn thật):
//   1. Vì sao API stateless lại tắt CSRF được, còn app dùng cookie thì không?
//   2. STATELESS nghĩa là gì về mặt bộ nhớ server, và nó liên quan gì tới việc
//      scale ngang?
//   3. Nếu ai đó lọt vào Docker network và gọi thẳng auth-service:8081, cấu hình
//      này có chặn được không? (gợi ý: gateway đang là thứ duy nhất validate JWT)
//
// Câu 3 chính là bài toán "trusted network" mà bạn sẽ phải giải khi viết Gateway.
// ============================================================================
