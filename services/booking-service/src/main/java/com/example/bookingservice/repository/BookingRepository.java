package com.example.bookingservice.repository;

import com.example.bookingservice.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByUserEmail(String userEmail);
    List<Booking> findByStatus(String status);

}
