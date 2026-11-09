package com.example.apigateway.lb;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

public class ServiceInstanceInfo {
    private final String url;
    private volatile boolean healthy;
    private final AtomicLong servedRequests = new AtomicLong(0);
    private volatile Instant lastCheckTime = Instant.now();
    private volatile String lastError = null;

    public ServiceInstanceInfo(String url) {
        this.url = url;
        this.healthy = true; // assume healthy initially, verified on first probe
    }

    public String getUrl() {
        return url;
    }

    public boolean isHealthy() {
        return healthy;
    }

    public void setHealthy(boolean healthy) {
        this.healthy = healthy;
        this.lastCheckTime = Instant.now();
    }

    public long getServedRequests() {
        return servedRequests.get();
    }

    public void incrementServedRequests() {
        this.servedRequests.incrementAndGet();
    }

    public Instant getLastCheckTime() {
        return lastCheckTime;
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }
}
