package com.rehmani.trading.config;

import com.rehmani.trading.service.SyncService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * After successful mutating API calls, bump the sync revision so all logged-in
 * clients (including concurrent owner sessions) refresh shared data.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
public class SyncBumpFilter extends OncePerRequestFilter {

    private final SyncService syncService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        filterChain.doFilter(request, response);

        String method = request.getMethod();
        if (!("POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method))) {
            return;
        }
        if (response.getStatus() >= 400) {
            return;
        }
        String path = request.getRequestURI();
        if (path == null) return;
        String p = path.toLowerCase();
        if (p.contains("/auth/")
                || p.contains("/sync/")
                || p.contains("/weather")
                || p.endsWith("/health")
                || p.contains("/ai/chat")) {
            return;
        }
        try {
            syncService.bump();
        } catch (Exception ignored) {
            // Never break the main request for sync bookkeeping
        }
    }
}
