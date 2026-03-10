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