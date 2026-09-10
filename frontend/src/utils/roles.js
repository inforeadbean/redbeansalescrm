// Central place for role identifiers so a typo (e.g. "sales_person" vs
// "salesperson") can't silently create a role that never matches anything
// in route guards or the sidebar.
export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  SALESPERSON: "salesperson",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Admin (MD)",
  [ROLES.MANAGER]: "Sales Manager",
  [ROLES.SALESPERSON]: "Sales Person",
};
