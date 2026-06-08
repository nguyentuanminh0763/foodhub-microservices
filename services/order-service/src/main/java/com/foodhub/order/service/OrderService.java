package com.foodhub.order.service;

// ============================================================================
// TODO (YOU CODE THIS) — order business logic
// ----------------------------------------------------------------------------
// placeOrder(request):
//   1. Với mỗi món trong đơn -> gọi RestaurantClient.getDish(...) để xác nhận
//      món tồn tại + lấy GIÁ THẬT (đồng bộ).
//   2. Tính tổng tiền từ giá lấy được (KHÔNG dùng giá client gửi).
//   3. Lưu Order vào MySQL (status = PENDING) qua OrderRepository.
//   4. [PHASE 2] gọi OrderEventPublisher.publishOrderPlaced(order) rồi trả về NGAY,
//      không đợi notification/payment.
//
// Annotation: @Service. Inject RestaurantClient + OrderRepository qua constructor.
// ============================================================================
public class OrderService {
    // your placeOrder() here
}
