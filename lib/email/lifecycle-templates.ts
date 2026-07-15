// lib/email/lifecycle-templates.ts
//
// Three account-lifecycle emails (welcome / day-3 / day-14), sent once each
// per profile by app/api/cron/send-lifecycle-emails/route.ts. Same visual
// language as lib/email/newsletter-templates.ts (dark card, #ff6a00 accent)
// for consistency, and the same DISCLAIMER_SHORT used site-wide — no new
// compliance language invented here; see lib/disclaimer.ts for the single
// source of truth (Keidi Carrington, Esq., letter dated 2026-07-09).
import { DISCLAIMER_SHORT } from '@/lib/disclaimer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ownfolio.net'

function wrap(preheader: string, title: string, bodyHtml: string, ctaLabel: string, ctaHref: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0f13;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#0e0f13;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0f13;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#14161c;border:1px solid #2a2d36;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 24px 8px 24px;">
          <div style="font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#8a8f9c;font-weight:600;">Ownfolio LLC</div>
          <h1 style="margin:8px 0 12px 0;color:#f2f3f5;font-size:20px;">${title}</h1>
          ${bodyHtml}
          <a href="${ctaHref}" style="display:inline-block;margin-top:8px;background:#ff6a00;color:#14161c;font-weight:700;font-size:13px;padding:10px 18px;border-radius:6px;text-decoration:none;">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:20px 24px 24px 24px;">
          <p style="margin:0;color:#6b6f7a;font-size:11px;line-height:1.6;">${DISCLAIMER_SHORT}</p>
          <p style="margin:10px 0 0 0;color:#6b6f7a;font-size:11px;line-height:1.6;">
            <a href="${APP_URL}/disclaimer" style="color:#8a8f9c;">Full disclaimer</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function renderWelcomeEmail(): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 12px 0;color:#b6bac4;font-size:14px;line-height:1.7;">
      Your account is set up. Ownfolio is built around one idea: own what you believe in, and hold it.
      We're not here to tell you what to buy or sell — we're here to give you clean data so you can make your own long-term calls.
    </p>
    <p style="margin:0 0 12px 0;color:#b6bac4;font-size:14px;line-height:1.7;">
      Everything in your dashboard is factual, not advice — ratios, allocations, and benchmarks, computed the same way for everyone.
    </p>`
  return {
    subject: 'Welcome to Ownfolio',
    html: wrap('Your Ownfolio account is ready.', 'Welcome to Ownfolio', body, 'Open your dashboard', `${APP_URL}/dashboard`),
  }
}

export function renderDay3Email(): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 12px 0;color:#b6bac4;font-size:14px;line-height:1.7;">
      A few things in your dashboard worth a look if you haven't already:
    </p>
    <ul style="margin:0 0 12px 0;padding-left:18px;color:#b6bac4;font-size:14px;line-height:1.8;">
      <li><strong style="color:#f2f3f5;">Fundamentals</strong> — valuation, growth, margin, and stability scores for anything you hold, computed the same way for every ticker.</li>
      <li><strong style="color:#f2f3f5;">Trailing Stop %</strong> — set one per holding in Tracker to see your stop price update automatically.</li>
      <li><strong style="color:#f2f3f5;">Allocation View &amp; Drawdown Alerts</strong> — a plain read on how concentrated your portfolio is and where it's pulled back from its highs.</li>
    </ul>
    <p style="margin:0 0 12px 0;color:#b6bac4;font-size:14px;line-height:1.7;">
      Ownfolio works best as a quiet companion to a long-term approach — check in when you want data, not because something's telling you to.
    </p>`
  return {
    subject: "A few things worth exploring in your dashboard",
    html: wrap('A few dashboard features worth a look.', 'Worth exploring', body, 'Explore your dashboard', `${APP_URL}/dashboard`),
  }
}

export function renderDay14Email(): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 12px 0;color:#b6bac4;font-size:14px;line-height:1.7;">
      No urgent news, no reason to log in today unless you want to. That's kind of the point —
      Ownfolio isn't built to chase your attention.
    </p>
    <p style="margin:0 0 12px 0;color:#b6bac4;font-size:14px;line-height:1.7;">
      If it's been a while since you checked your dashboard, it's still there, still current, whenever you're ready.
    </p>`
  return {
    subject: 'Still here, still boring (on purpose)',
    html: wrap('Your dashboard, whenever you want it.', 'Still here, still boring', body, 'Open your dashboard', `${APP_URL}/dashboard`),
  }
}
