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
            // 이전 대화(Postman tests) 흐름상 accessToken JSON을 기대
            const token = res?.data?.accessToken
            if (!token) throw new Error('login response에 accessToken이 없습니다.')
            this.setToken(token)
            await this.fetchMe()
        },

        async logoutAll() {
            // 프로젝트에 logout-all이 있던 흐름(이전 대화) 기준
            await api.post('/api/auth/logout-all', null, { headers: this.authHeader() })
            this.setToken('')
            this.me = null
        },

        async fetchMe() {
            const res = await api.get('/api/me', { headers: this.authHeader() })
            this.me = res.data
            return this.me
        },
    },
})