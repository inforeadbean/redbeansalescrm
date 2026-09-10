import api from "./api.js";

// `history` is the prior turns [{role: "user"|"assistant", content}] — kept
// short by the caller (AskAssistant.jsx) so the request stays small.
export const askAssistant = (message, history) =>
  api.post("/assistant/chat", { message, history }).then((r) => r.data);
