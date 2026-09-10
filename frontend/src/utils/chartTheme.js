// Chart palette. Validated (light mode) with the dataviz skill's
// scripts/validate_palette.js — lightness band, chroma floor, CVD separation
// and surface contrast all pass. Assign categorical hues in THIS fixed order,
// never cycled; a chart with one series just uses BRAND (the RBH red).
export const BRAND = "#C1121F";

export const CATEGORICAL = ["#C1121F", "#2563EB", "#D97706", "#7C3AED", "#0D9488"];

// Lead-stage chart colours — mirrors `fill` in constants.js LEAD_STATUS so
// every chart, the Kanban and the badges all read the same.
export const STAGE_FILL = {
  new: "#DC2626",
  webinar_interested: "#FBBF24",
  webinar_attended: "#D97706",
  event_interested: "#60A5FA",
  event_attended: "#2563EB",
  course_interested: "#A78BFA",
  converted: "#059669",
  followup: "#C026D3",
  dead: "#9CA3AF",
  invalid: "#64748B",
};

// Recessive axis / grid / ink tokens.
export const AXIS = "#94A3B8";
export const GRID = "#E5E7EB";
export const INK = "#374151";

export const RYG_FILL = {
  green: "#16A34A",
  yellow: "#D97706",
  red: "#DC2626",
  none: "#94A3B8",
};
