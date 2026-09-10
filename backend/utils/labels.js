// Human-readable labels for the enum values stored on models. Used where the
// backend itself needs prose — e.g. the auto-written "Status changed: New →
// Contacted" remark, and column headers in generated report exports.

export const LEAD_STATUS_LABELS = {
  new: "New",
  webinar_interested: "Interested for Zoom 1",
  webinar_attended: "Zoom 1 Attended",
  event_interested: "Interested for event",
  event_attended: "Event attended",
  course_interested: "Interested for course",
  converted: "Converted",
  followup: "Followup",
  dead: "Dead",
  invalid: "Invalid",
};

export const LEAD_SOURCE_LABELS = {
  webinar: "Zoom meeting",
  referral: "Referral",
  cold_call: "Cold call",
  social: "Social",
  walk_in: "Walk-in",
  other: "Other",
};

export const CALL_OUTCOME_LABELS = {
  connected: "Connected",
  no_answer: "No answer",
  busy: "Busy",
  not_interested: "Not interested",
  callback: "Callback requested",
  converted: "Converted",
};
