package com.example.bookingservice.controller;

import com.example.bookingservice.entity.Booking;
import com.example.bookingservice.repository.BookingRepository;
import com.example.bookingservice.dto.BookingAdminResponse;
import com.example.bookingservice.dto.RoomResponse;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/bookings")
public class BookingController {

    private final BookingRepository bookingRepository;
    private final RestTemplate restTemplate;

    public BookingController(
            BookingRepository bookingRepository,
            RestTemplate restTemplate
    ) {
        this.bookingRepository = bookingRepository;
        this.restTemplate = restTemplate;
    }

    // ================= USER BOOKING =================

    @PostMapping(consumes = "application/json")
    public Booking createBooking(@RequestBody Booking booking) {

        booking.setStatus("PENDING_PAYMENT");

        if (booking.getUserEmail() == null) {
            booking.setUserEmail("demo@user.com");
        }

        return bookingRepository.save(booking);
    }

    @GetMapping
    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    @GetMapping("/user")
    public List<Booking> getBookingsByUser(@RequestParam String email) {
        return bookingRepository.findByUserEmail(email);
    }

    @PutMapping("/{id}/cancel")
    public Booking cancelBooking(@PathVariable Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setStatus("CANCELLED");
        return bookingRepository.save(booking);
    }

    @GetMapping("/{id}")
public Booking getBookingById(@PathVariable Long id) {
    return bookingRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Booking not found"));
}


    @PutMapping("/{id}/confirm")
public Booking confirmBooking(@PathVariable Long id) {

    Booking booking = bookingRepository.findById(id)
        .orElseThrow(() -> new RuntimeException("Booking not found"));

    if ("CANCELLED".equals(booking.getStatus())) {
        throw new RuntimeException("Cannot confirm a cancelled booking");
    }

    booking.setStatus("CONFIRMED");
    return bookingRepository.save(booking);
}


    @PutMapping("/{id}/fail")
    public Booking failBooking(@PathVariable Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setStatus("PAYMENT_FAILED");
        return bookingRepository.save(booking);
    }

    @GetMapping("/active")
    public List<Booking> getActiveBookings() {
        return bookingRepository.findByStatus("CONFIRMED");
    }

    // ================= ADMIN BOOKING =================

    @GetMapping("/admin")
    public List<BookingAdminResponse> getAllBookingsForAdmin() {

        return bookingRepository.findAll()
                .stream()
                .map(b -> {

                    RoomResponse room = restTemplate.getForObject(
                            "http://localhost:8083/rooms/" + b.getRoomId(),
                            RoomResponse.class
                    );

                    return new BookingAdminResponse(
                            b.getId(),
                            b.getUserEmail(),
                            b.getRoomId(),
                            room != null ? room.getName() : "N/A",
                            room != null ? room.getPrice() : 0,
                            b.getCheckIn(),
                            b.getCheckOut(),
                            b.getStatus()
                    );
                })
                .collect(Collectors.toList());
    }
}
