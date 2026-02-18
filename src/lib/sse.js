import { fetchEventSource } from '@microsoft/fetch-event-source'

export function connectSse({ url, token, onMessage, onError, onOpen }) {
    const ctrl = new AbortController()

    fetchEventSource(url, {
        signal: ctrl.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onopen(res) {
            onOpen?.(res)
        },
        onmessage(ev) {
            onMessage?.(ev)
        },
        onerror(err) {
            onError?.(err)
            // 기본은 재시도하므로, 끊고 싶으면 throw
            // throw err
        },
    })

    return () => ctrl.abort()
}