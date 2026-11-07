package com.example.paymentservice.dto;

public class BookingResponse {
    private Long id;
    private Long roomId;
    private String status;

    public Long getId() { return id; }
    public Long getRoomId() { return roomId; }
    public String getStatus() { return status; }

    public void setId(Long id) { this.id = id; }
    public void setRoomId(Long roomId) { this.roomId = roomId; }
    public void setStatus(String status) { this.status = status; }
}
