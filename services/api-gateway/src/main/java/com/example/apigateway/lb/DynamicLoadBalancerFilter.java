package com.example.apigateway.lb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.RouteToRequestUrlFilter;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

import java.net.URI;

@Component
public class DynamicLoadBalancerFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(DynamicLoadBalancerFilter.class);

    private final LoadBalancerRegistry registry;

    public DynamicLoadBalancerFilter(LoadBalancerRegistry registry) {
        this.registry = registry;
    }

    @Override
    public int getOrder() {
        // Run after RouteToRequestUrlFilter (10000) so GATEWAY_REQUEST_URL_ATTR is present,
        // but before NettyRoutingFilter (LOWEST_PRECEDENCE) so the downstream URI can be dynamically redirected.
        return RouteToRequestUrlFilter.ROUTE_TO_URL_FILTER_ORDER + 50;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String serviceName = resolveServiceName(path);

        if (serviceName != null) {
            ServiceInstanceInfo selected = registry.choose(serviceName);
            if (selected != null) {
                URI currentUrl = exchange.getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR);
                if (currentUrl != null) {
                    URI targetBase = URI.create(selected.getUrl());
                    URI newUrl = UriComponentsBuilder.fromUri(currentUrl)
                            .scheme(targetBase.getScheme())
                            .host(targetBase.getHost())
                            .port(targetBase.getPort())
                            .build(true)
                            .toUri();

                    exchange.getAttributes().put(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, newUrl);

                    // Add headers using beforeCommit to ensure they are written to final client response
                    String servedByVal = targetBase.getHost() + ":" + targetBase.getPort();
                    exchange.getResponse().beforeCommit(() -> {
                        exchange.getResponse().getHeaders().set("X-Served-By", servedByVal);
                        exchange.getResponse().getHeaders().set("X-Load-Balanced", "true");
                        exchange.getResponse().getHeaders().set("X-LB-Strategy", "Round-Robin-HealthAware");
                        exchange.getResponse().getHeaders().set("X-Service-Name", serviceName);
                        return Mono.empty();
                    });

                    log.info("[LB-ROUTE] {} {} -> forwarded to instance {} (Total handled by this instance: {})",
                            exchange.getRequest().getMethod(),
                            path,
                            servedByVal,
                            selected.getServedRequests());
                }
            }
        }

        return chain.filter(exchange);
    }

    private String resolveServiceName(String path) {
        if (path.startsWith("/api/rooms") || path.startsWith("/rooms")) {
            return "room-service";
        } else if (path.startsWith("/api/bookings") || path.startsWith("/bookings")) {
            return "booking-service";
        } else if (path.startsWith("/api/users") || path.startsWith("/users")) {
            return "user-service";
        } else if (path.startsWith("/api/auth") || path.startsWith("/auth")) {
            return "auth-service";
        } else if (path.startsWith("/api/payments") || path.startsWith("/payments")) {
            return "payment-service";
        }
        return null;
    }
}
