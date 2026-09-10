import api from "./api.js";

export const getFiveForThree = (params) =>
  api.get("/reports/five-for-three", { params }).then((r) => r.data);
export const getCallingReport = (params) =>
  api.get("/reports/calling", { params }).then((r) => r.data);
export const getLeaderboard = (params) =>
  api.get("/reports/leaderboard", { params }).then((r) => r.data);
export const getFunnelReport = (params) =>
  api.get("/reports/funnel", { params }).then((r) => r.data);
export const getReceivables = (params) =>
  api.get("/reports/receivables", { params }).then((r) => r.data);
export const getPaymentDelays = (params) =>
  api.get("/reports/payment-delays", { params }).then((r) => r.data);
