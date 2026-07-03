// Organization role hierarchy. Canonical tiers (high → low):
//   Company Admin > Manager > Team Lead > Employee
// Legacy values ('Admin' = Team Lead, 'Member' = Employee) are still recognized
// by rank so existing data keeps working.

export type MemberRole = 'Company Admin' | 'Manager' | 'Team Lead' | 'Employee' | 'Admin' | 'Member'

// Roles offered in pickers (new canonical set only).
export const ROLES: MemberRole[] = ['Company Admin', 'Manager', 'Team Lead', 'Employee']

const RANK: Record<string, number> = {
  Employee: 1, Member: 1,
  'Team Lead': 2, Admin: 2,
  Manager: 3,
  'Company Admin': 4
}

export function roleRank(role?: string | null): number {
  return RANK[role ?? ''] ?? 0
}

// Display legacy role names using the new vocabulary.
export function roleLabel(role?: string | null): string {
  if (role === 'Admin') return 'Team Lead'
  if (role === 'Member') return 'Employee'
  return role || '—'
}

export const RANK_COMPANY_ADMIN = 4
export const RANK_MANAGER = 3
export const RANK_LEAD = 2
export const RANK_EMPLOYEE = 1
