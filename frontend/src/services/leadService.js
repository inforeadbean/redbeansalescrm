import api from "./api.js";

export const listLeads = (params) => api.get("/leads", { params }).then((r) => r.data);
export const getKanban = (params) =>
  api.get("/leads", { params: { ...params, view: "kanban" } }).then((r) => r.data);
// One column's next slice ({ column, items, total }) — used as a board column
// auto-fills on scroll. `skip` = how many of that column are already loaded.
export const getKanbanColumn = (params) =>
  api.get("/leads", { params: { ...params, view: "kanban" } }).then((r) => r.data);
export const getPipeline = (params) =>
  api.get("/leads/meta/pipeline", { params }).then((r) => r.data);
export const getLead = (id) => api.get(`/leads/${id}`).then((r) => r.data);
export const createLead = (body) => api.post("/leads", body).then((r) => r.data);
// CSV / Excel import. Sent in chunks so a large migration doesn't exceed the
// request-size limit or tie up one long request. Per-chunk results are merged;
// skipped-row numbers are shifted back to their position in the original file.
// `onProgress(done, total)` fires after each chunk.
export const bulkCreateLeads = async (leads, assignedTo, onProgress) => {
  const CHUNK = 500;
  const merged = { created: 0, skippedCount: 0, skipped: [] };
  for (let i = 0; i < leads.length; i += CHUNK) {
    const { data } = await api.post("/leads/bulk", {
      leads: leads.slice(i, i + CHUNK),
      assignedTo,
    });
    merged.created += data.created;
    merged.skippedCount += data.skippedCount;
    for (const s of data.skipped || []) {
      if (merged.skipped.length < 100) merged.skipped.push({ ...s, row: s.row + i });
    }
    onProgress?.(Math.min(i + CHUNK, leads.length), leads.length);
  }
  return merged;
};
export const updateLead = (id, body) => api.put(`/leads/${id}`, body).then((r) => r.data);
export const updateLeadStatus = (id, body) =>
  api.patch(`/leads/${id}/status`, body).then((r) => r.data);
export const undoLeadStatus = (id) =>
  api.post(`/leads/${id}/undo-status`).then((r) => r.data);
export const assignLead = (id, assignedTo) =>
  api.patch(`/leads/${id}/assign`, { assignedTo }).then((r) => r.data);
export const deleteLead = (id) => api.delete(`/leads/${id}`).then((r) => r.data);
export const listRemarks = (id, params) =>
  api.get(`/leads/${id}/remarks`, { params }).then((r) => r.data);
export const addRemark = (id, text) =>
  api.post(`/leads/${id}/remarks`, { text }).then((r) => r.data);
