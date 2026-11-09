package com.example.roomservice;

import com.example.roomservice.entity.Room;
import com.example.roomservice.repository.RoomRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;

import java.util.List;

@SpringBootApplication
@EnableCaching
public class RoomServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RoomServiceApplication.class, args);
    }

    @Bean
    CommandLineRunner initRooms(RoomRepository roomRepository) {
        return args -> {
            if (roomRepository.count() == 0) {
                List<Room> initialRooms = List.of(
                        new Room("Standard 101", 2, 800000),
                        new Room("Standard 102", 2, 800000),
                        new Room("Standard 103", 2, 850000),
                        new Room("Standard 104", 2, 850000),
                        new Room("Deluxe 201", 3, 1200000),
                        new Room("Deluxe 202", 3, 1200000),
                        new Room("Deluxe 203", 3, 1250000),
                        new Room("Deluxe 204", 3, 1250000),
                        new Room("Family 301", 4, 1600000),
                        new Room("Family 302", 4, 1600000),
                        new Room("Family 303", 4, 1650000),
                        new Room("Family 304", 4, 1650000),
                        new Room("Suite 401", 2, 2200000),
                        new Room("Suite 402", 2, 2200000),
                        new Room("Suite 403", 2, 2300000),
                        new Room("Presidential 501", 4, 3500000),
                        new Room("Presidential 502", 4, 3500000),
                        new Room("Penthouse 601", 3, 3000000),
                        new Room("Penthouse 602", 3, 3000000),
                        new Room("Royal Suite 701", 2, 4000000)
                );
                roomRepository.saveAll(initialRooms);
                System.out.println(">>> Initialized 20 rooms into database.");
            } else {
                System.out.println(">>> Rooms already exist in database (" + roomRepository.count() + " rooms). Skipping init.");
            }
        };
    }
}
