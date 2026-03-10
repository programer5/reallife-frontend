import api from "@/lib/api";

export async function fetchAdminDashboard() {
    const res = await api.get("/admin/dashboard");
    return res.data;
}

export async function fetchAdminErrors() {
    const res = await api.get("/admin/errors");
    return res.data;
}

export async function sendAdminAlertTest() {
    const res = await api.post("/admin/alerts/test");
    return res.data;
}

export async function fetchAdminAlertHistory() {
    const res = await api.get("/admin/alerts/history");
    return res.data;
}

export async function fetchAdminHealth() {
    const res = await api.get("/admin/health");
    return res.data;
}

export async function fetchAdminRealtimeHealth() {
    const res = await api.get("/admin/health/realtime");
    return res.data;
}

export async function fetchAdminReminderHealth() {
    const res = await api.get("/admin/health/reminder");
    return res.data;
}

export const sendOpsAlertTest = sendAdminAlertTest;

export async function fetchOpsAlertHistory() {
    const res = await api.get("/admin/alerts/history");
    return res.data?.items || [];
}