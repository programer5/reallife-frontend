import axios from 'axios'
import { useAuthStore } from '../stores/auth'

export const api = axios.create({
    baseURL: '/',
    withCredentials: false,
})

/**
 * 요청 인터셉터
 * 모든 요청에 accessToken 자동 첨부
 */
api.interceptors.request.use((config) => {
    const auth = useAuthStore()

    if (auth?.accessToken) {
        config.headers.Authorization = `Bearer ${auth.accessToken}`
    }

    return config
})

/**
 * 응답 인터셉터
 * 401이면 자동 로그아웃 처리
 */
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const auth = useAuthStore()

        if (err?.response?.status === 401 && auth?.accessToken) {
            console.warn('401 detected → force logout')
            auth.forceResetAuth()
            window.location.href = '/login'
        }

        return Promise.reject(err)
    }
)