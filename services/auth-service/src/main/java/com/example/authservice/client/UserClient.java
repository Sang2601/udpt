package com.example.authservice.client;

import com.example.authservice.dto.UserResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class UserClient {

    private final RestTemplate restTemplate = new RestTemplate();

    public UserResponse getUserByEmail(String email) {
        String url = "http://localhost:8081/users/by-email?email=" + email;
        return restTemplate.getForObject(url, UserResponse.class);
    }
}
