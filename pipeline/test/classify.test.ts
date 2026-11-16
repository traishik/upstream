import { describe, expect, it } from 'vitest';
import { Classifier } from '../classify.ts';

const c = Classifier.load();

// [title, function, level, company?]
const cases: [string, string, string, string?][] = [
  // The tricky ones from the brief
  ['Product Marketing Manager', 'marketing-communications', 'mid'],
  ['Technical Program Manager III', 'program-management', 'senior'],
  ['Software Engineer II', 'software-engineering', 'mid'],
  ['University Grad – SWE', 'software-engineering', 'new-grad'],
  ['Summer 2027 Intern', 'other', 'internship'],
  // Software engineering
  ['Software Engineer', 'software-engineering', 'mid'],
  ['Senior Software Engineer, Payments', 'software-engineering', 'senior'],
  ['Staff Software Engineer - Infrastructure', 'software-engineering', 'staff'],
  ['Principal Engineer, Distributed Systems', 'software-engineering', 'staff'],
  ['Software Development Engineer I', 'software-engineering', 'new-grad'],
  ['SDE II, Amazon Web Services', 'software-engineering', 'mid'],
  ['Frontend Engineer', 'software-engineering', 'mid'],
  ['Senior Full Stack Engineer', 'software-engineering', 'senior'],
  ['iOS Engineer, Consumer', 'software-engineering', 'mid'],
  ['Site Reliability Engineer III', 'software-engineering', 'senior'],
  ['Backend Engineer, New Grad 2027', 'software-engineering', 'new-grad'],
  ['Software Engineer Intern, Summer 2027', 'software-engineering', 'internship'],
  ['Lead DevOps Engineer', 'software-engineering', 'senior'],
  ['Android Developer', 'software-engineering', 'mid'],
  ['Distinguished Engineer', 'software-engineering', 'staff'],
  ['Junior Web Developer', 'software-engineering', 'new-grad'],
  ['Software Engineer, Early Career', 'software-engineering', 'new-grad'],
  ['SDET II', 'software-engineering', 'mid'],
  ['Solutions Architect', 'software-engineering', 'staff'],
  // Engineering management
  ['Engineering Manager, Payments Platform', 'engineering-management', 'manager'],
  ['Senior Engineering Manager', 'engineering-management', 'senior-manager'],
  ['Director of Engineering', 'engineering-management', 'director'],
  ['VP, Engineering', 'engineering-management', 'vp'],
  ['Software Development Manager, Alexa', 'engineering-management', 'manager'],
  ['Manager, Software Engineering', 'engineering-management', 'manager'],
  // Product management
  ['Product Manager', 'product-management', 'mid'],
  ['Senior Product Manager, Growth', 'product-management', 'senior'],
  ['Principal Product Manager - Technical', 'product-management', 'staff'],
  ['Group Product Manager', 'product-management', 'senior-manager'],
  ['Director, Product Management', 'product-management', 'director'],
  ['Associate Product Manager', 'product-management', 'new-grad'],
  ['Product Owner', 'product-management', 'mid'],
  ['Head of Product', 'product-management', 'director'],
  // Program & project
  ['Program Manager', 'program-management', 'mid'],
  ['Senior Program Manager, Operations', 'program-management', 'senior'],
  ['Technical Program Manager', 'program-management', 'mid'],
  ['Project Manager - Construction', 'program-management', 'mid'],
  ['Reverse Logistics Customer Experience Program Manager', 'program-management', 'mid'],
  ['Scrum Master', 'program-management', 'mid'],
  ['Director, Program Management Office', 'program-management', 'director'],
  // Data, AI & ML
  ['Data Scientist', 'data-ai-ml', 'mid'],
  ['Senior Data Scientist, Ads', 'data-ai-ml', 'senior'],
  ['Machine Learning Engineer', 'data-ai-ml', 'mid'],
  ['Research Scientist, Interpretability', 'data-ai-ml', 'mid'],
  ['Applied Scientist II', 'data-ai-ml', 'mid'],
  ['Data Engineer III', 'data-ai-ml', 'senior'],
  ['Data Analyst', 'data-ai-ml', 'mid'],
  ['Research Engineer, Pretraining', 'data-ai-ml', 'mid'],
  ['AI Engineer, Agents', 'data-ai-ml', 'mid'],
  ['Business Intelligence Engineer', 'data-ai-ml', 'mid'],
  ['PhD Intern - Machine Learning', 'data-ai-ml', 'internship'],
  // Design & research
  ['Product Designer', 'design-research', 'mid'],
  ['Senior UX Researcher', 'design-research', 'senior'],
  ['Staff Product Designer', 'design-research', 'staff'],
  ['Design Manager', 'design-research', 'manager'],
  ['Content Designer', 'design-research', 'mid'],
  // Hardware & silicon
  ['ASIC Design Engineer', 'hardware-silicon', 'mid'],
  ['Senior Physical Design Engineer', 'hardware-silicon', 'senior'],
  ['Firmware Engineer', 'hardware-silicon', 'mid'],
  ['GPU Architect', 'hardware-silicon', 'staff'],
  ['Mechanical Engineer II', 'hardware-silicon', 'mid'],
  ['Design Verification Engineer', 'hardware-silicon', 'mid'],
  ['Sr. Electrical Hardware Engineer', 'hardware-silicon', 'senior'],
  ['Process Engineer, Etch', 'hardware-silicon', 'mid'],
  // Security & IT
  ['Security Engineer', 'security-it', 'mid'],
  ['Senior Detection & Response Engineer, Security', 'security-it', 'senior'],
  ['IT Support Specialist', 'security-it', 'mid'],
  ['Information Security Analyst', 'security-it', 'mid'],
  ['Network Engineer', 'security-it', 'mid'],
  // Sales & partnerships
  ['Account Executive, Enterprise', 'sales-partnerships', 'mid'],
  ['Senior Account Executive', 'sales-partnerships', 'senior'],
  ['Sales Development Representative', 'sales-partnerships', 'mid'],
  ['Business Development Manager', 'sales-partnerships', 'manager'],
  ['Partnerships Lead', 'sales-partnerships', 'senior'],
  ['Account Manager, Mid-Market', 'sales-partnerships', 'mid'],
  ['Regional Sales Director', 'sales-partnerships', 'director'],
  ['TikTok Shop - Merchant Growth Program Manager', 'program-management', 'mid'],
  // Marketing & communications
  ['Marketing Manager', 'marketing-communications', 'mid'],
  ['Senior Product Marketing Manager', 'marketing-communications', 'senior'],
  ['Communications Lead', 'marketing-communications', 'senior'],
  ['Brand Designer', 'design-research', 'mid'],
  ['Content Marketing Specialist', 'marketing-communications', 'mid'],
  ['Director, Corporate Communications', 'marketing-communications', 'director'],
  // Finance & accounting
  ['Financial Analyst', 'finance-accounting', 'mid'],
  ['Senior Accountant', 'finance-accounting', 'senior'],
  ['Tax Manager', 'finance-accounting', 'manager'],
  ['FP&A Manager', 'finance-accounting', 'manager'],
  ['Controller', 'finance-accounting', 'mid'],
  ['Chief Financial Officer', 'finance-accounting', 'vp'],
  // Legal, policy & compliance
  ['Product Counsel', 'legal-policy-compliance', 'mid'],
  ['Senior Corporate Counsel', 'legal-policy-compliance', 'senior'],
  ['Compliance Analyst', 'legal-policy-compliance', 'mid'],
  ['Public Policy Manager', 'legal-policy-compliance', 'manager'],
  ['Paralegal', 'legal-policy-compliance', 'mid'],
  // People & recruiting
  ['Technical Recruiter', 'people-recruiting', 'mid'],
  ['Senior Recruiter', 'people-recruiting', 'senior'],
  ['HR Business Partner', 'people-recruiting', 'mid'],
  ['Head of Talent', 'people-recruiting', 'director'],
  ['People Operations Specialist', 'people-recruiting', 'mid'],
  // Operations & supply chain
  ['Supply Chain Manager', 'operations-supply-chain', 'manager'],
  ['Business Operations Manager', 'operations-supply-chain', 'mid'],
  ['Logistics Coordinator', 'operations-supply-chain', 'mid'],
  ['Strategy & Operations Lead', 'operations-supply-chain', 'senior'],
  ['Procurement Specialist', 'operations-supply-chain', 'mid'],
  ['Chief of Staff, CEO Office', 'operations-supply-chain', 'vp'],
  // Customer success & support
  ['Customer Success Manager', 'customer-success-support', 'mid'],
  ['Technical Support Engineer', 'customer-success-support', 'mid'],
  ['Customer Experience Specialist', 'customer-success-support', 'mid'],
  ['Implementation Manager', 'customer-success-support', 'manager'],
  // Healthcare, science & research
  ['Registered Nurse - ICU', 'healthcare-science', 'mid'],
  ['Clinical Research Associate', 'healthcare-science', 'mid'],
  ['Senior Scientist, Biologics', 'healthcare-science', 'senior'],
  ['Pharmacist', 'healthcare-science', 'mid'],
  // Manufacturing & skilled trades
  ['Manufacturing Technician', 'manufacturing-trades', 'mid'],
  ['CNC Machinist', 'manufacturing-trades', 'mid'],
  ['Maintenance Mechanic', 'manufacturing-trades', 'mid'],
  ['Welder - 2nd Shift', 'manufacturing-trades', 'mid'],
  ['Production Supervisor', 'manufacturing-trades', 'manager'],
  // Leadership
  ['Vice President, Global Supply Chain', 'operations-supply-chain', 'vp'],
  ['General Manager, Ads', 'other', 'vp'],
  // Banking titles (company overrides)
  ['Vice President, Software Engineer', 'software-engineering', 'senior', 'jpmorgan-chase'],
  ['Executive Director - Product Manager', 'product-management', 'director', 'jpmorgan-chase'],
  ['Managing Director, Investment Banking', 'finance-accounting', 'vp', 'goldman-sachs'],
  ['Associate - Data Engineer', 'data-ai-ml', 'mid', 'citigroup'],
  ['Analyst, Corporate Finance', 'finance-accounting', 'new-grad', 'morgan-stanley'],
  ['2027 Summer Analyst Program - Markets', 'finance-accounting', 'internship', 'jpmorgan-chase'],
];

describe('classifier: function and level', () => {
  it('has at least 100 real-world titles', () => expect(cases.length).toBeGreaterThanOrEqual(100));
  for (const [title, fn, level, company] of cases) {
    it(`${title}${company ? ` @${company}` : ''}`, () => {
      expect({ fn: c.fn(title).id, level: c.level(title, company) }).toEqual({ fn, level });
    });
  }
});

describe('classifier: frontline', () => {
  const yes = ['Store Manager', 'Warehouse Associate', 'Delivery Driver', 'Bank Teller', 'Part Time (30 Hours) Associate Banker, Carmel Rancho Branch, Carmel, CA',
    'US - Specialist: Seasonal, Part-time', 'Customer Service Representative - Call Center', 'Fulfillment Center Associate', 'Cashier', 'Package Handler', 'Shift Supervisor'];
  const no = ['Software Engineer', 'Store Operations Program Manager', 'Product Manager, Retail', 'Data Scientist', 'Senior Recruiter', 'Customer Success Manager'];
  for (const t of yes) it(`frontline: ${t}`, () => expect(c.isFrontline(t)).toBe(true));
  for (const t of no) it(`not frontline: ${t}`, () => expect(c.isFrontline(t)).toBe(false));
});

describe('classifier: employment type', () => {
  const cases: [string, string | undefined, string][] = [
    ['Software Engineer', 'Full time', 'full-time'],
    ['Software Engineer Intern', undefined, 'internship'],
    ['Associate Banker', 'Part time', 'part-time'],
    ['Data Analyst (Contract)', undefined, 'contract'],
    ['Seasonal Retail Specialist', undefined, 'contract'],
    ['Engineer', 'FullTime', 'full-time'],
    ['Recruiter', 'Fixed Term', 'contract'],
  ];
  for (const [t, raw, want] of cases) it(`${t} / ${raw}`, () => expect(c.employment(t, raw)).toBe(want));
});
