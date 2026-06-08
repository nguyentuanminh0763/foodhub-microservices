package com.foodhub.order.controller;

import org.springframework.web.bind.annotation.*;

// ============================================================================
// TODO (YOU CODE THIS) — REST endpoints
// ----------------------------------------------------------------------------
//   POST /api/orders        body: { restaurantId, items:[{dishId, quantity}] } -> 201 + order
//   GET  /api/orders/{id}   -> 200 + order
// Controller gọi OrderService, không chứa logic. Tạo DTO cho request/response.
// Path /api/orders/** để khớp route bạn sẽ thêm ở Gateway.
// ============================================================================
@RestController
@RequestMapping("/api/orders")
public class OrderController {

    // PLUMBING - health check
    @GetMapping("/health")
    public String health() {
        return "order-service OK";
    }

    // your POST /  and  GET /{id}  here
}
