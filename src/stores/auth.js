import { defineStore } from 'pinia'
import { api } from '../lib/api'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        accessToken: localStorage.getItem('accessToken') || '',
        me: null,
    }),

    getters: {
        isAuthed: (s) => !!s.accessToken,
    },

    actions: {
        setToken(token) {
            this.accessToken = token || ''
            if (token) localStorage.setItem('accessToken', token)
            else localStorage.removeItem('accessToken')
        },

        authHeader() {
            return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}
        },

        async login(email, password) {
            const res = await api.post('/api/auth/login', { email, password })
            const token = res?.data?.accessToken
            if (!token) throw new Error('login response에 accessToken이 없습니다.')

            this.setToken(token)
            await this.fetchMe()
        },

        async logoutAll() {
            // ✅ 핵심: 서버 요청 실패(401 포함)해도 프론트는 무조건 로그아웃 상태로 정리
            try {
                await api.post('/api/auth/logout-all', null, { headers: this.authHeader() })
            } catch (e) {
                // 토큰 만료/무효 등으로 401 나와도 UX 깨지지 않게 무시
                console.warn('logout-all failed (ignored):', e?.response?.status || e?.message)
            } finally {
                this.setToken('')
                this.me = null
            }
        },

        async fetchMe() {
            const res = await api.get('/api/me', { headers: this.authHeader() })
            this.me = res.data
            return this.me
        },

        // 필요하면 어디서든 강제 초기화 가능
        forceResetAuth() {
            this.setToken('')
            this.me = null
        },
    },
})