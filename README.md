# distributed-hotel-booking
Distributed Hotel Booking System - Distributed Applications
cd /workspaces/distributed-hotel-booking
pwd

# CHẠY USER-SERVICE
cd services/user-service
./mvnw clean spring-boot:run

# CHẠY AUTH-SERVICE
cd services/auth-service
./mvnw clean spring-boot:run

# CHẠY BOOKING SERVICE
cd /workspaces/distributed-hotel-booking
cd services/booking-service
mvn spring-boot:run

# CHẠY API-GATEWAY
cd services/api-gateway
./mvnw clean spring-boot:run

# room-service
cd services/room-service
mvn spring-boot:run

# Payment Service
cd services/payment-service
mvn spring-boot:run

# web
cd /workspaces/distributed-hotel-booking/frontend
python3 -m http.server 5500


# LOGIN QUA API GATEWAY (LẤY TOKEN)

curl -X POST http://localhost:8088/api/auth/login \
-H "Content-Type: application/json" \
-d '{"email":"admin@test.com","password":"123456"}'

# GỌI USER SERVICE QUA GATEWAY (JWT)
curl http://localhost:8088/api/users \
-H "Authorization: Bearer <TOKEN>"



curl http://localhost:8082/users \
-H "Authorization: Bearer <PASTE_TOKEN_HERE>"

cd /workspaces/distributed-hotel-booking/frontend
python3 -m http.server 5500

# Mở H2 Console
http://localhost:8081/h2-console
jdbc:h2:mem:bookingdb

SELECT * FROM users;
SELECT * FROM BOOKING;


# Mở file shell config
nano ~/.bashrc

# Thêm cuối file
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# Áp dụng
source ~/.bashrc

# Kiểm tra
java -version
mvn -version

jdbc:h2:mem:bookingdb
SHOW TABLES;
SELECT * FROM BOOKING;
SELECT * FROM BOOKING ORDER BY ID DESC;
SELECT COUNT(*) FROM BOOKING;

jdbc:h2:mem:roomdb
SHOW TABLES;

jdbc:h2:mem:paymentdb
SHOW TABLES;
SELECT * FROM PAYMENT;
SELECT * FROM PAYMENT WHERE BOOKING_ID = 1;
SELECT COUNT(*) FROM PAYMENT;
SELECT COUNT(*) FROM PAYMENT;