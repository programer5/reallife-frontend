import axios from "axios";

/**
 * ✅ 쿠키 기반 인증 전제
 * - withCredentials: true 로 쿠키 자동 전송
 * - 401이면 /api/auth/refresh-cookie 호출 후 원요청 1회 재시도
 */
const api = axios.create({
    baseURL: "",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

let refreshing = false;
let waiters = [];

function notifyAll(error) {
    waiters.forEach((w) => w(error));
    waiters = [];
}

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;

        if (!original || original._retry) {
            return Promise.reject(err);
        }

        // 쿠키 세션 만료(401)면 refresh-cookie 시도
        if (err.response?.status === 401) {
            original._retry = true;

            // 이미 refresh 중이면 끝날 때까지 대기
            if (refreshing) {
                return new Promise((resolve, reject) => {
                    waiters.push((e) => (e ? reject(e) : resolve(api(original))));
                });
            }

            refreshing = true;
            try {
                await api.post("/api/auth/refresh-cookie");
                refreshing = false;
                notifyAll(null);
                return api(original);
            } catch (e) {
                refreshing = false;
                notifyAll(e);
                return Promise.reject(e);
            }
        }

        return Promise.reject(err);
    }
);

export default api;