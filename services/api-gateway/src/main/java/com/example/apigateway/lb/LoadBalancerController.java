package com.example.apigateway.lb;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.*;

@RestController
@RequestMapping("/api/lb")
@CrossOrigin(origins = "*")
public class LoadBalancerController {

    private final LoadBalancerRegistry registry;

    public LoadBalancerController(LoadBalancerRegistry registry) {
        this.registry = registry;
    }

    @GetMapping("/status")
    public Mono<Map<String, Object>> getStatus() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", System.currentTimeMillis());
        result.put("strategy", "Round-Robin-HealthAware");

        Map<String, Object> servicesMap = new LinkedHashMap<>();
        for (Map.Entry<String, List<ServiceInstanceInfo>> entry : registry.getAllServices().entrySet()) {
            String serviceName = entry.getKey();
            List<Map<String, Object>> instList = new ArrayList<>();
            for (ServiceInstanceInfo inst : entry.getValue()) {
                Map<String, Object> instData = new LinkedHashMap<>();
                instData.put("url", inst.getUrl());
                instData.put("healthy", inst.isHealthy());
                instData.put("servedRequests", inst.getServedRequests());
                instData.put("lastCheckTime", inst.getLastCheckTime().toString());
                instData.put("lastError", inst.getLastError());
                instList.add(instData);
            }
            servicesMap.put(serviceName, instList);
        }

        result.put("services", servicesMap);
        return Mono.just(result);
    }
}
