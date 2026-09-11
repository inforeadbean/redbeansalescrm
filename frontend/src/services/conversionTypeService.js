import api from "./api.js";

export const listConversionTypes = () => api.get("/conversion-types").then((r) => r.data);

export const createConversionType = (body) =>
  api.post("/conversion-types", body).then((r) => r.data);
