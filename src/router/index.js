import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    { path: '/', redirect: '/inbox' },

    // 로그인은 별도 화면
    { path: '/login', component: () => import('../views/LoginView.vue') },

    // 앱 내부(탭 포함) 화면들은 AppShell 안에 렌더링
    {
        path: '/',
        component: () => import('../layouts/AppShell.vue'),
        children: [
            { path: 'inbox', component: () => import('../views/InboxView.vue') },
            { path: 'home', component: () => import('../views/HomeView.vue') },
            { path: 'search', component: () => import('../views/SearchView.vue') },
            { path: 'me', component: () => import('../views/MeView.vue') },
        ],
    },
]

export const router = createRouter({
    history: createWebHistory(),
    routes,
})

import { useAuthStore } from '../stores/auth'

router.beforeEach((to) => {
    const auth = useAuthStore()

    // 로그인 화면은 예외
    if (to.path === '/login') return true

    // 앱 내부는 토큰 없으면 로그인으로
    if (!auth.accessToken) return '/login'
    return true
})
