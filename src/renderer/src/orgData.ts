// Company organization chart (source: OrgTree.pdf).
// Reporting lines were reconstructed from the chart layout — adjust here if any
// manager/report relationship needs correcting.

export interface OrgNode {
  name: string
  initials?: string
  role?: string
  location?: string // 'H.O' (Ahmedabad, Gujarat) | 'WFH'
  team?: number // team-size badge shown on the chart
  group?: boolean // a department/section header rather than a person
  children?: OrgNode[]
}

export const ORG_TREE: OrgNode = {
  name: 'C-Suite',
  role: 'CXO Roles',
  location: 'H.O',
  group: true,
  children: [
    {
      name: 'Prachi Majithia', initials: 'PM', role: 'Process Head', location: 'H.O', team: 1,
      children: []
    },
    {
      name: 'Bhagwati Pathak', initials: 'BP', role: 'Chief Operating Officer', location: 'H.O',
      children: [
        {
          name: 'Kuldeep Gajjar', initials: 'KG', role: 'Director', location: 'H.O', team: 6,
          children: [
            { name: 'Glory Joy', initials: 'GJ', role: 'Senior Specialist', location: 'WFH', team: 29 },
            { name: 'Subhashree Singh', initials: 'SS', role: 'Manager', location: 'H.O' },
            { name: 'Hardik Agarwal', initials: 'HA', role: 'Manager', location: 'H.O', team: 40 },
            { name: 'Akshita Sood', initials: 'AS', role: 'Architectural Strategy Head', location: 'WFH' }
          ]
        },
        {
          name: 'Business Development', group: true,
          children: [
            { name: 'Hannanbeig Mirza', initials: 'HM', role: 'Senior Associate', location: 'H.O' }
          ]
        },
        {
          name: 'KAM', group: true,
          children: [
            { name: 'Rajat Goel', initials: 'RG', role: 'Manager', location: 'H.O' },
            { name: 'Neha Balasubramaniam', initials: 'NB', role: 'Manager', location: 'H.O', team: 3 }
          ]
        }
      ]
    },
    {
      name: 'Marketing', group: true,
      children: [
        { name: 'Divya Dave', initials: 'DD', role: 'Asst. Director', location: 'H.O', team: 2 }
      ]
    },
    {
      name: 'Business Development', group: true,
      children: [
        { name: 'Prex Poojara', initials: 'PP', role: 'Executive Director', location: 'H.O' }
      ]
    },
    {
      name: 'HR', group: true,
      children: [
        { name: 'HR Admin', initials: 'HA', role: 'HR Admin', location: 'H.O' }
      ]
    }
  ]
}

// Deterministic accent colour from initials/name for the avatar.
export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return `hsl(${h}, 55%, 45%)`
}
