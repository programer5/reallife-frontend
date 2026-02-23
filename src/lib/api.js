// src/lib/api.js
import axios from "axios";

/**
 * RealLife API client (Cookie-based auth)
 * - withCredentials: true (HttpOnly cookies)
 * - 401 -> refresh-cookie -> retry original request exactly once
 * - refresh-cookie is called via a separate client to avoid interceptor loops
 */

export const api = axios.create({
    baseURL: "",
    withCredentials: true,
    timeout: 15000,
});

const refreshClient = axios.create({
    baseURL: "",
    withCredentials: true,
    timeout: 15000,
});

// refresh 상태 공유
let refreshing = false;
let waiters = [];

/** notify queued requests after refresh attempt */
function resolveWaiters(err) {
    const current = waiters;
    waiters = [];
    current.forEach((fn) => fn(err));
}

async function refreshCookie() {
    // IMPORTANT: do NOT use `api` client here (would recurse on 401)
    await refreshClient.post("/api/auth/refresh-cookie");
}

function isRefreshRequest(config) {
    const url = config?.url || "";
    return url.includes("/api/auth/refresh-cookie");
}

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const status = error?.response?.status;
        const config = error?.config;

        // Network / CORS / timeout: 그대로 throw
        if (!status || !config) throw error;

        // refresh-cookie 자체가 401이면 여기서 더는 못함
        if (status === 401 && isRefreshRequest(config)) {
            throw error;
        }

        // 401: refresh 후 원요청 1회 재시도
        if (status === 401 && !config.__isRetryRequest) {
            // 이미 refresh 중이면 큐에 대기
            if (refreshing) {
                await new Promise((resolve, reject) => {
                    waiters.push((err) => (err ? reject(err) : resolve()));
                });
                config.__isRetryRequest = true;
                return api.request(config);
            }

            refreshing = true;
            try {
                await refreshCookie();
                resolveWaiters(null);
                config.__isRetryRequest = true;
                return api.request(config);
            } catch (e) {
                resolveWaiters(e);
                throw e;
            } finally {
                refreshing = false;
            }
        }

        throw error;
    }
);

export default api;