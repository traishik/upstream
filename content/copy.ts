/**
 * UI copy, all in one place so it can be edited without touching components.
 * Voice: a calm, experienced friend who has been through it. No hype, no fake urgency.
 */
export const copy = {
  hero: {
    /** The first entry is used on the site. The others are kept for the /styleguide review. */
    headlines: [
      "Your next role is out there. Let's go straight to it.",
      'Stop applying into the void.',
      'Real jobs. Real companies. Straight from the source.',
    ],
    sub: "No ghost listings. No reposts from months ago. Every role here comes straight from the company's own careers page and is checked to be live, so your effort goes where it counts.",
    primaryCta: 'Browse live roles',
    secondaryCta: 'How we verify',
  },
  trust: ['Straight from career pages', 'Verified live every few hours', 'Built by a job seeker, for job seekers'],
  entryPaths: [
    { label: 'Students & New Grads', hint: 'Internships, new grad and early-career roles', href: '/jobs?level=internship,new-grad' },
    { label: 'Experienced', hint: 'Mid, senior, staff and principal roles', href: '/jobs?level=mid,senior,staff' },
    { label: 'Leadership', hint: 'Managers, directors, VPs and executives', href: '/jobs?level=manager,senior-manager,director,vp' },
  ],
  encouragement: [
    'One great application beats a hundred rushed ones.',
    'A quiet week is not a verdict on you.',
    "You only need one yes. Everything before it is practice.",
    'Tailor the first three lines. That is where people decide to keep reading.',
    'Rest counts as part of the search.',
    'Write to the team, not the system.',
    'Your experience is worth describing in your own words.',
    "Fewer, better applications. You'll feel the difference.",
  ],
  empty: {
    title: 'Nothing here yet',
    body: 'New roles land every few hours. Try widening your filters, or tell us which company we are missing.',
    cta: 'Suggest a company',
  },
  /** Companies whose careers pages don't let us fetch listings. Positive, honest, and in motion. */
  linkOnly: {
    badge: 'Direct to source',
    title: (company: string) => `${company} hires on its own turf`,
    body: (company: string) =>
      `${company} hasn't opened its careers feed to us yet. We keep asking, and we check again every few hours. The day it opens, every live ${company} role lands here, verified like the rest. Until then, their official careers page is one click away.`,
    alt: (company: string) =>
      `We're still knocking on ${company}'s door. The moment their careers feed opens up, you'll see every verified role right here. For now, we'll take you straight to the source.`,
    cta: (company: string) => `Explore ${company} careers`,
  },
  /** Inside Track: people who work at listed companies sharing tips and referral links. */
  insiders: {
    eyebrow: 'Inside Track',
    promptTitle: 'Work at one of these companies?',
    promptBody:
      "Someone once took a chance on you. Pay it forward: share what you wish you'd known before applying, or a referral link for an open role. It takes two minutes, and it could change someone's year.",
    promptCta: 'Share a tip or referral',
    sectionTitle: (company: string) => `From people inside ${company}`,
    referralLabel: 'Referral link',
    referralCta: 'Use my referral',
    disclaimer:
      'Shared by community members and reviewed by us before it appears. Not verified by the company. A referral never costs you money; never pay anyone for one.',
    empty: (company: string) => `No tips from inside ${company} yet. Work there? Be the first to light the way.`,
    report: 'Report',
  },
  verified: (ago: string) => `Verified live · ${ago}`,
  stale: 'Data may be stale. Our last refresh took longer than usual.',
  apply: (company: string) => `Apply on ${company}`,
  feedbackPrompt: 'Got an idea? We read every note.',
} as const;
