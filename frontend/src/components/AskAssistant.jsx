import { useEffect, useRef, useState } from "react";
import { MdOutlineSmartToy, MdClose, MdSend } from "react-icons/md";
import { useAuth } from "../context/AuthContext.jsx";
import { askAssistant } from "../services/assistantService.js";

const PLACEHOLDER = {
  salesperson: "Apne leads, follow-ups, target ke baare me pooch lo…",
  manager: "Apni team ke leads, revenue, follow-ups ke baare me pooch lo…",
  admin: "Company-wide leads, revenue, team ke baare me pooch lo…",
};

// Floating "Ask" chat — on every logged-in page. Each reply is grounded only
// in the caller's own scoped CRM data (built server-side from the same
// role-based scoping every other screen uses), so a salesperson only ever
// gets answers about their own leads. Conversation lives in memory only —
// it resets on reload, by design (no chat history stored anywhere).
export default function AskAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // [{role, content}]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError("");
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await askAssistant(
        text,
        messages.slice(-6) // short rolling context, kept client-side only
      );
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(typeof err === "string" ? err : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-primary text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MdOutlineSmartToy size={18} />
              <span className="font-semibold text-sm truncate">Ask — your CRM data</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white">
              <MdClose size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-6 px-4">
                {PLACEHOLDER[user?.role] || "Apne data ke baare me kuch bhi pooch sakte ho."}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400">
                  Soch raha hoon…
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 p-2.5 flex items-end gap-2 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Type a question…"
              disabled={busy}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm max-h-24 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="shrink-0 h-9 w-9 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90"
            >
              <MdSend size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Ask the assistant"}
        className="fixed bottom-4 right-4 sm:right-6 z-50 h-12 w-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:opacity-90 transition"
      >
        {open ? <MdClose size={22} /> : <MdOutlineSmartToy size={22} />}
      </button>
    </>
  );
}
