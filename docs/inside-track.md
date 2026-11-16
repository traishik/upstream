# Inside Track: tips and referrals from people who work there

Added at the Phase 1 review (2026-11-14). Visuals are in /styleguide#inside-track. The build lands in Phase 4, alongside feedback, because it uses the same pieces (Turnstile, D1, moderation).

## What it is
People who work at a listed company share:
- **a tip**: what they wish they'd known before applying (max 600 characters), and/or
- **a referral link**: for any role, a team, or one specific posting, with a short note.

They can optionally add a first name, role and tenure ("Priya · Senior Engineer · 3 yrs"). Anonymous is fine.

## Where it shows
- **/insiders:** everything, filterable by company
- **/companies/[slug]:** "From people inside {Company}", plus the invite prompt
- **Job detail sidebar:** referrals for that company, below the Apply area and never between the reader and Apply
- **Home:** a small invite prompt

## Safety rules (these matter more than the feature)
1. **Referral links are allowlisted.** They're accepted only on the company's own domain or its verified ATS board, from `config/companies.yaml`, the same proof we already record. No link shorteners or personal sites, so a card can never send someone somewhere unsafe.
2. **No contact details are published.** Submitters can't post email addresses or phone numbers; the form rejects them. The optional reply email goes to the owner only, never onto the page.
3. **Pre-moderation.** Nothing appears until the owner approves it with a CLI script (`npm run insiders:review`), which approves or rejects pending items in D1. Approved items are baked into static JSON at the next deploy, so the public site stays static.
4. **Expiry.** Referral links are hidden after 90 days unless the submitter re-confirms via a private renewal link. Tips stay up.
5. **Report link** on every card. It feeds the same moderation queue.
6. **Clear disclaimer:** "Shared by community members and reviewed by us… Not verified by the company. A referral never costs you money; never pay anyone for one."
7. **No IP storage.** Turnstile and rate limiting are the same as feedback.

## Not in v1
- Verifying that someone actually works at the company (a work-email check would need sending email, which isn't free). The disclaimer covers this.
- Accounts, upvotes and comments.
