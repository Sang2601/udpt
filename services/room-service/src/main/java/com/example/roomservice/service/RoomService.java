package com.example.roomservice.service;

import com.example.roomservice.entity.Room;
import com.example.roomservice.repository.RoomRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class RoomService {

    private final RoomRepository roomRepository;

    public RoomService(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    // 🔍 SEARCH AVAILABLE ROOMS
    @Cacheable(value = "searchRooms", key = "#capacity")
    public List<Room> searchAvailableRooms(
            int capacity,
            LocalDate checkIn,
            LocalDate checkOut
    ) {
        return roomRepository.findByCapacity(capacity);
    }

    // 📋 ADMIN: GET ALL ROOMS (Cached for high throughput scalability)
    @Cacheable(value = "allRooms")
    public List<Room> getAllRooms() {
        return roomRepository.findAll();
    }

    // 🔥 GET ROOM BY ID
    public Room getRoomById(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Room not found"));
    }
}
