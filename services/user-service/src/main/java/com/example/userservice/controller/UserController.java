package com.example.userservice.controller;

import com.example.userservice.dto.UserAuthResponse;
import com.example.userservice.dto.UserCreateRequest;
import com.example.userservice.entity.User;
import com.example.userservice.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserController {


    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // CREATE USER
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public User createUser(@RequestBody UserCreateRequest request) {
        return userService.createUser(request);
    }

    // GET ALL USERS
    @GetMapping
    public List<User> getAllUsers() {
        return userService.getAllUsers();
    }

    // 🔥 DÙNG RIÊNG CHO AUTH-SERVICE
    @GetMapping("/by-email")
    public ResponseEntity<UserAuthResponse> getUserByEmail(
            @RequestParam String email
    ) {
        User user = userService.getUserByEmail(email);

        if (user == null) {
            return ResponseEntity.notFound().build(); // ✅ 404
        }

        UserAuthResponse response = new UserAuthResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getPassword(), // 🔥 QUAN TRỌNG
                user.getRole()
        );

        return ResponseEntity.ok(response);
    }
}
