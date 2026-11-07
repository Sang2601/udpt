package com.example.authservice.service;

import com.example.authservice.client.UserClient;
import com.example.authservice.dto.UserResponse;
import com.example.authservice.security.JwtUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserClient userClient;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthService(UserClient userClient, JwtUtil jwtUtil) {
        this.userClient = userClient;
        this.jwtUtil = jwtUtil;
    }

    public AuthResult login(String email, String password) {

        /* =========================================================
           ✅ ADMIN CỨNG – PHỤC VỤ QUẢN TRỊ (CHO ĐỒ ÁN)
           ========================================================= */

        // ADMIN 1
        if (
            email.equals("23010139@gmail.com") &&
            password.equals("nht123456")
        ) {
            String token = jwtUtil.generateToken(email, "ADMIN");
            return new AuthResult(token, "ADMIN");
        }

        // ADMIN 2
        if (
            email.equals("23010192@gmail.com") &&
            password.equals("pnv123456")
        ) {
            String token = jwtUtil.generateToken(email, "ADMIN");
            return new AuthResult(token, "ADMIN");
        }
        // ADMIN 3 (Test Admin from README)
        if (
            email.equals("admin@test.com") &&
            password.equals("123456")
        ) {
            String token = jwtUtil.generateToken(email, "ADMIN");
            return new AuthResult(token, "ADMIN");
        }


        /* =========================================================
           👤 USER THƯỜNG – KIỂM TRA QUA USER-SERVICE
           ========================================================= */

        UserResponse user = userClient.getUserByEmail(email);

        if (user == null || user.getPassword() == null
                || !passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(email, user.getRole());
        return new AuthResult(token, user.getRole());
    }

    /* =========================================================
       DTO TRẢ KẾT QUẢ LOGIN
       ========================================================= */
    public static class AuthResult {
        private final String token;
        private final String role;

        public AuthResult(String token, String role) {
            this.token = token;
            this.role = role;
        }

        public String getToken() {
            return token;
        }

        public String getRole() {
            return role;
        }
    }
}
