package com.foodhub.order.client;

// ============================================================================
// TODO (YOU CODE THIS) — SYNCHRONOUS inter-service call  *** KEY LESSON ***
// ----------------------------------------------------------------------------
// Đây là chỗ Order service GỌI SANG Restaurant service qua REST và ĐỢI kết quả.
// Đây là ví dụ điển hình của giao tiếp ĐỒNG BỘ giữa các service.
//
// Việc cần làm:
//   - Tạo một method getDish(restaurantId, dishId) trả về thông tin món (tên, giá,
//     còn bán không) bằng cách gọi GET tới
//     {restaurant.service.url}/api/restaurants/{restaurantId}/dishes/{dishId}
//   - Dùng RestClient (Spring 6) hoặc RestTemplate. Đọc base URL từ @Value.
//
// PRE-READ (hỏi ở chat trước khi code):
//   - Vì sao bước kiểm tra món + giá phải gọi đồng bộ (đợi kết quả) chứ không async?
//   - Điều gì xảy ra nếu restaurant-service chết? Order nên xử lý lỗi/timeout ra sao?
//     (từ khoá để tìm hiểu: timeout, retry, circuit breaker - phần nâng cao)
//   - Vì sao KHÔNG tin giá do client gửi lên mà phải hỏi lại restaurant-service?
// ============================================================================
public class RestaurantClient {
    // your sync REST call here
}
