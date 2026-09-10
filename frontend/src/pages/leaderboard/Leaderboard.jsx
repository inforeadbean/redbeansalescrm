import { useCallback, useEffect, useState } from "react";
import { MdEmojiEvents } from "react-icons/md";
import PageHeader from "../../components/PageHeader.jsx";
import Card from "../../components/ui/Card.jsx";
import Spinner from "../../components/ui/Spinner.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { LEADERBOARD_BADGES } from "../../utils/constants.js";
import { inrCompact, initials } from "../../utils/format.js";
import { getLeaderboard } from "../../services/reportService.js";

const PERIODS = [
  { key: "month", label: "Last 30 days" },
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
];

const RANK_STYLE = ["bg-amber-400 text-white", "bg-slate-300 text-white", "bg-orange-300 text-white"];

export default function Leaderboard() {
  const toast = useToast();
  const { user } = useAuth();
  const [period, setPeriod] = useState("month");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows } = await getLeaderboard({ period });
      setRows(rows);
    } catch (err) {
      toast.error(err);
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Weighted activity score: leads ×1, calls ×2, zoom ×3, event ×4, conversion ×25, +₹1k = 1 pt."
      />

      <Tabs tabs={PERIODS} active={period} onChange={setPeriod} />

      <div className="mt-4 space-y-3">
        {loading ? (
          <Spinner />
        ) : (
          rows.map((r) => {
            const isMe = r.salespersonId === user.id;
            return (
              <Card
                key={r.salespersonId}
                padding="p-4"
                className={isMe ? "ring-2 ring-primary/40" : ""}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      RANK_STYLE[r.rank - 1] || "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.rank}
                  </span>
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary-dark flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials(r.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                      {r.name}
                      {isMe && <span className="text-xs text-primary font-normal">(you)</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                      <span>{r.leadsAdded} leads</span>
                      <span>{r.callsCompleted} calls</span>
                      <span>{r.webinarAttendees + r.eventAttendees} attendees</span>
                      <span>{r.conversions} conversions</span>
                      <span>{inrCompact(r.revenue)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.badges.map((b) => (
                      <span key={b} title={LEADERBOARD_BADGES[b]?.label} className="text-lg">
                        {LEADERBOARD_BADGES[b]?.icon}
                      </span>
                    ))}
                    <span className="text-lg font-bold text-gray-800 tabular-nums w-16 text-right">
                      {r.score}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })
        )}
        {!loading && rows.length === 0 && (
          <Card>
            <p className="text-sm text-gray-400 text-center py-6">No activity in this period yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
