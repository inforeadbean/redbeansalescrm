// Lead phones are captured as a plain 10-digit number (no country code, spaces
// or punctuation). `phoneDigits` strips everything else; `isTenDigits` is the
// gate used when a lead is created or its phone edited by hand.
export const phoneDigits = (p) => String(p ?? "").replace(/\D/g, "");
export const isTenDigits = (p) => phoneDigits(p).length === 10;
