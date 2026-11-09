FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/room-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8083
VOLUME /app/data
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
