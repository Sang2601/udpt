package com.example.roomservice.controller;

import com.example.roomservice.entity.Room;
import com.example.roomservice.service.RoomService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    // 🔍 SEARCH ROOM
    @GetMapping("/search")
    public List<Room> searchRooms(
            @RequestParam int capacity,
            @RequestParam LocalDate checkIn,
            @RequestParam LocalDate checkOut
    ) {
        return roomService.searchAvailableRooms(capacity, checkIn, checkOut);
    }

    // 📋 GET ALL ROOMS (ADMIN)
    @GetMapping
    public List<Room> getAllRooms() {
        return roomService.getAllRooms();
    }

    // 🔥 GET ROOM BY ID (BOOKING ADMIN)
    @GetMapping("/{id}")
    public Room getRoomById(@PathVariable Long id) {
        return roomService.getRoomById(id);
    }
}
