import axios from 'axios'

export const api = axios.create({
    baseURL: '',           // vite proxy 쓰면 비워도 됨
    withCredentials: true, // 쿠키 로그인 대비(있어도 무해)
})