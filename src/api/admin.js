import api from "@/lib/api";

export async function fetchAdminDashboard() {
    const res = await api.get("/admin/dashboard");
    return res.data;
}

export async function fetchAdminErrors() {
    const res = await api.get("/admin/errors");
    return res.data;
}