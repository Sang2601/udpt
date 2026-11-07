package com.example.bookingservice.dto;

import java.time.LocalDate;

public class BookingAdminResponse {

    private Long id;
    private String userEmail;
    private Long roomId;
    private String roomName;
    private double roomPrice;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private String status;

    public BookingAdminResponse(
            Long id,
            String userEmail,
            Long roomId,
            String roomName,
            double roomPrice,
            LocalDate checkIn,
            LocalDate checkOut,
            String status
    ) {
        this.id = id;
        this.userEmail = userEmail;
        this.roomId = roomId;
        this.roomName = roomName;
        this.roomPrice = roomPrice;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public Long getRoomId() {
        return roomId;
    }

    public String getRoomName() {
        return roomName;
    }

    public double getRoomPrice() {
        return roomPrice;
    }

    public LocalDate getCheckIn() {
        return checkIn;
    }

    public LocalDate getCheckOut() {
        return checkOut;
    }

    public String getStatus() {
        return status;
    }
}
