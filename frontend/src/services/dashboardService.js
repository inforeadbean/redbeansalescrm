import api from "./api.js";

export const getSummary = (params) => api.get("/dashboard/summary", { params }).then((r) => r.data);
export const getFunnel = (params) => api.get("/dashboard/funnel", { params }).then((r) => r.data);
export const getTrends = (params) => api.get("/dashboard/trends", { params }).then((r) => r.data);
export const getMyTasks = () => api.get("/dashboard/my-tasks").then((r) => r.data);
export const getTeamPipeline = () => api.get("/dashboard/team-pipeline").then((r) => r.data);
