package com.example.paymentservice.controller;

import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.repository.PaymentRepository;
import com.example.paymentservice.dto.BookingResponse;
import com.example.paymentservice.dto.RoomResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Random;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentRepository paymentRepository;
    private final RestTemplate restTemplate;
    private final Random random = new Random();

    public PaymentController(
            PaymentRepository paymentRepository,
            RestTemplate restTemplate
    ) {
        this.paymentRepository = paymentRepository;
        this.restTemplate = restTemplate;
    }

    // ================== PAY ==================
    // ================== PAY ==================
@PostMapping
public ResponseEntity<?> pay(@RequestBody Payment payment) {

    // 1️⃣ LẤY BOOKING
    String bookingUrl =
            "http://localhost:8088/api/bookings/" + payment.getBookingId();

    BookingResponse booking;
    try {
        booking = restTemplate.getForObject(
                bookingUrl,
                BookingResponse.class
        );
    } catch (Exception e) {
        return ResponseEntity
                .badRequest()
                .body("❌ Booking không tồn tại");
    }

    // 2️⃣ CHECK TRẠNG THÁI BOOKING
    if ("CANCELLED".equals(booking.getStatus())) {
        return ResponseEntity
                .badRequest()
                .body("❌ Booking đã bị huỷ");
    }

    if (!"PENDING_PAYMENT".equals(booking.getStatus())) {
        return ResponseEntity
                .badRequest()
                .body("❌ Booking không hợp lệ để thanh toán");
    }

    // 3️⃣ LẤY GIÁ PHÒNG TỪ ROOM SERVICE (BACKEND QUYẾT ĐỊNH)
    String roomUrl =
            "http://localhost:8088/api/rooms/" + booking.getRoomId();

    RoomResponse room;
    try {
        room = restTemplate.getForObject(
                roomUrl,
                RoomResponse.class
        );
    } catch (Exception e) {
        return ResponseEntity
                .badRequest()
                .body("❌ Không lấy được thông tin phòng");
    }

    if (room == null || room.getPrice() == null) {
        return ResponseEntity
                .badRequest()
                .body("❌ Giá phòng không hợp lệ");
    }

    // 4️⃣ SET DỮ LIỆU PAYMENT (BACKEND TOÀN QUYỀN)
    payment.setBookingId(booking.getId());
    payment.setAmount(room.getPrice());

    // 5️⃣ GIẢ LẬP THANH TOÁN
    boolean success = random.nextInt(10) < 7;
    payment.setStatus(success ? "SUCCESS" : "FAILED");

    Payment savedPayment = paymentRepository.save(payment);

    // 6️⃣ UPDATE BOOKING
    if (success) {
        restTemplate.put(bookingUrl + "/confirm", null);
    } else {
        restTemplate.put(bookingUrl + "/fail", null);
    }

    // 7️⃣ TRẢ KẾT QUẢ
    return ResponseEntity.ok(savedPayment);
}

    // ================== REVENUE ==================
    @GetMapping("/revenue/total")
    public Double getTotalRevenue() {
        return paymentRepository.getTotalRevenue();
    }
}
