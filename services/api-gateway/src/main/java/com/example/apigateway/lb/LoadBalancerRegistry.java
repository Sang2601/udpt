package com.example.apigateway.lb;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@EnableScheduling
public class LoadBalancerRegistry {

    private static final Logger log = LoggerFactory.getLogger(LoadBalancerRegistry.class);

    private final Map<String, List<ServiceInstanceInfo>> services = new ConcurrentHashMap<>();
    private final Map<String, AtomicInteger> roundRobinIndices = new ConcurrentHashMap<>();
    private final WebClient webClient = WebClient.builder().build();

    @Value("${gateway.lb.room-service.instances:http://localhost:8083,http://localhost:8085}")
    private String roomInstancesConfig;

    @Value("${gateway.lb.booking-service.instances:http://localhost:8082,http://localhost:8086}")
    private String bookingInstancesConfig;

    @Value("${gateway.lb.user-service.instances:http://localhost:8081}")
    private String userInstancesConfig;

    @Value("${gateway.lb.auth-service.instances:http://localhost:8080}")
    private String authInstancesConfig;

    @Value("${gateway.lb.payment-service.instances:http://localhost:8084}")
    private String paymentInstancesConfig;

    @PostConstruct
    public void init() {
        registerService("room-service", roomInstancesConfig);
        registerService("booking-service", bookingInstancesConfig);
        registerService("user-service", userInstancesConfig);
        registerService("auth-service", authInstancesConfig);
        registerService("payment-service", paymentInstancesConfig);

        log.info("Initialized LoadBalancerRegistry with services: {}", services.keySet());
        // Run initial health check immediately
        probeAllInstances();
    }

    private void registerService(String serviceName, String configStr) {
        List<ServiceInstanceInfo> list = new ArrayList<>();
        String[] parts = configStr.split(",");
        for (String url : parts) {
            String trimmed = url.trim();
            if (!trimmed.isEmpty()) {
                list.add(new ServiceInstanceInfo(trimmed));
            }
        }
        services.put(serviceName, list);
        roundRobinIndices.put(serviceName, new AtomicInteger(0));
    }

    public ServiceInstanceInfo choose(String serviceName) {
        List<ServiceInstanceInfo> instances = services.get(serviceName);
        if (instances == null || instances.isEmpty()) {
            return null;
        }

        // Filter healthy instances
        List<ServiceInstanceInfo> healthyList = new ArrayList<>();
        for (ServiceInstanceInfo inst : instances) {
            if (inst.isHealthy()) {
                healthyList.add(inst);
            }
        }

        // If no instance is marked healthy, fallback to all instances (optimistic retry)
        List<ServiceInstanceInfo> candidatePool = healthyList.isEmpty() ? instances : healthyList;

        AtomicInteger indexCounter = roundRobinIndices.get(serviceName);
        int index = Math.abs(indexCounter.getAndIncrement() % candidatePool.size());
        ServiceInstanceInfo selected = candidatePool.get(index);
        selected.incrementServedRequests();
        return selected;
    }

    @Scheduled(fixedRate = 4000)
    public void probeAllInstances() {
        for (Map.Entry<String, List<ServiceInstanceInfo>> entry : services.entrySet()) {
            String serviceName = entry.getKey();
            for (ServiceInstanceInfo instance : entry.getValue()) {
                probeSingleInstance(serviceName, instance);
            }
        }
    }

    private void probeSingleInstance(String serviceName, ServiceInstanceInfo instance) {
        String healthUrl = instance.getUrl() + "/actuator/health";
        webClient.get()
                .uri(healthUrl)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofMillis(1500))
                .subscribe(
                        response -> {
                            boolean wasHealthy = instance.isHealthy();
                            instance.setHealthy(true);
                            instance.setLastError(null);
                            if (!wasHealthy) {
                                log.info("[HEALTH-CHECK] Service '{}' at {} is back ONLINE", serviceName, instance.getUrl());
                            }
                        },
                        error -> {
                            boolean wasHealthy = instance.isHealthy();
                            instance.setHealthy(false);
                            instance.setLastError(error.getMessage());
                            if (wasHealthy) {
                                log.warn("[HEALTH-CHECK] Service '{}' at {} is DOWN: {}", serviceName, instance.getUrl(), error.getMessage());
                            }
                        }
                );
    }

    public Map<String, List<ServiceInstanceInfo>> getAllServices() {
        return Collections.unmodifiableMap(services);
    }
}
