/**
 * gateway/src/loadBalancer.js
 * Intelligent Round-Robin & Least-Connections Load Balancer for Microservice Replicas.
 * Features:
 * - Real-time health probing (Heartbeat ping)
 * - Automatic dead-replica eviction & self-healing re-admission
 * - Request metrics tracking (total requests, latency, active connections)
 */

export class LoadBalancedCluster {
  constructor(serviceName, replicaUrls, strategy = 'round-robin') {
    this.serviceName = serviceName;
    this.strategy = strategy;
    this.replicas = replicaUrls.map((url, idx) => ({
      id: `${serviceName}-replica-${idx + 1}`,
      url: url.trim(),
      healthy: true,
      activeConnections: 0,
      totalRequests: 0,
      failedRequests: 0,
      lastChecked: Date.now(),
      lastError: null
    }));
    this.currentIndex = 0;
    this._startHealthProbing();
  }

  _startHealthProbing() {
    setInterval(() => this.checkHealth(), 3000);
  }

  async checkHealth() {
    for (const replica of this.replicas) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${replica.url}/health`, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          if (!replica.healthy) {
            console.log(`[Gateway LoadBalancer] 🟢 Node ${replica.id} (${replica.url}) đã KHÔI PHỤC và hoạt động trở lại!`);
          }
          replica.healthy = true;
          replica.lastError = null;
        } else {
          this._markUnhealthy(replica, `HTTP ${res.status}`);
        }
      } catch (err) {
        this._markUnhealthy(replica, err.message);
      } finally {
        replica.lastChecked = Date.now();
      }
    }
  }

  _markUnhealthy(replica, reason) {
    if (replica.healthy) {
      console.warn(`[Gateway LoadBalancer] ⚠️ Node ${replica.id} (${replica.url}) GẶP SỰ CỐ: ${reason}. Tự động loại bỏ khỏi bảng điều phối tải!`);
    }
    replica.healthy = false;
    replica.lastError = reason;
  }

  getNextReplica() {
    const available = this.replicas.filter(r => r.healthy);
    if (!available.length) {
      // If all down, fallback to first replica attempt
      return this.replicas[0] || null;
    }

    if (this.strategy === 'least-connections') {
      available.sort((a, b) => a.activeConnections - b.activeConnections);
      return available[0];
    }

    // Default: Round-Robin
    const selected = available[this.currentIndex % available.length];
    this.currentIndex = (this.currentIndex + 1) % available.length;
    return selected;
  }

  getStats() {
    return {
      service: this.serviceName,
      strategy: this.strategy,
      totalNodes: this.replicas.length,
      healthyNodes: this.replicas.filter(r => r.healthy).length,
      replicas: this.replicas.map(r => ({
        id: r.id,
        url: r.url,
        healthy: r.healthy,
        activeConnections: r.activeConnections,
        totalRequests: r.totalRequests,
        failedRequests: r.failedRequests,
        lastError: r.lastError
      }))
    };
  }
}

