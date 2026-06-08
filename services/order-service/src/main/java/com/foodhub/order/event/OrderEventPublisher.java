package com.foodhub.order.event;

// ============================================================================
// TODO (YOU CODE THIS — PHASE 2) — ASYNCHRONOUS event publishing  *** KEY LESSON ***
// ----------------------------------------------------------------------------
// Để DÀNH cho Giai đoạn 2. Khi tới Phase 2:
//   - Bật dependency spring-boot-starter-amqp trong pom.xml
//   - publishOrderPlaced(order): gửi một message "OrderPlaced" lên RabbitMQ exchange.
//   - Order service KHÔNG biết ai nhận. Notification service sẽ tự lắng nghe.
//
// PRE-READ (Phase 2):
//   - Async khác sync ở chỗ nào? Vì sao gửi thông báo nên async?
//   - exchange / queue / routing key trong RabbitMQ là gì?
//   - Nếu Notification service đang chết lúc event được phát thì sao? (durable queue)
// ============================================================================
public class OrderEventPublisher {
    // Phase 2: your publish logic here
}
