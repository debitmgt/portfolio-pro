// lib/disclaimer.ts
// Single source of truth for Ownfolio LLC's disclaimer, publisher's-exclusion
// positioning, and Terms of Use. Attorney-drafted language (Keidi Carrington,
// Esq., letter dated 2026-07-09) reproduced verbatim — do not paraphrase; any
// wording change here should go back through counsel first.

export const DISCLAIMER_SHORT =
  'For informational and educational purposes only — impersonal, historical data publication, not personalized advice or recommendations. Ownfolio does not act as your investment adviser or broker.'

export const SUPPORT_LINE = 'For technical issues, contact support@ownfolio.net.'

export const DISCLAIMER_FULL = [
  "Ownfolio LLC publishes portfolio tracking tools, market data, analytics, and commentary solely for informational and educational purposes. Ownfolio is not providing investment advice, legal advice, tax advice, accounting advice, or any recommendation, offer, or solicitation to buy, sell, or hold any security. The content is made available on the same basis to all users and is not tailored to any person's investment objectives, financial situation, risk tolerance, or particular needs. Section 202(a)(11)(D) of the Investment Advisers Act excludes from the definition of investment adviser the publisher of any bona fide newspaper, news magazine, or business or financial publication of general and regular circulation, and the Supreme Court in Lowe v. SEC explained that impersonal, disinterested publications of general and regular circulation fall within that exclusion.",
  'Any rankings, allocation views, concentration metrics, drawdown alerts, watchlists, screens, summaries, or similar analytics are generated through standardized, rules-based methods and are impersonal in nature. They do not constitute personalized advice, suitability determinations, or recommendations concerning any security, transaction, account, or investment strategy. Ownfolio does not manage assets, execute trades, place orders, rebalance accounts, or undertake to monitor any account for the purpose of making investment decisions. Use of the site does not create an investment adviser-client, fiduciary, brokerage, or other advisory relationship.',
  'Market data and other third-party content may be delayed, incomplete, or inaccurate. Past performance, hypothetical results, and backtested results are not guarantees of future performance. Investing involves risk, including possible loss of principal. Users should conduct their own diligence and consult their own professional advisers before making any investment, legal, tax, or accounting decision.',
] as const

export const TERMS_OF_USE = [
  {
    heading: 'Informational Publication; No Investment Advice',
    paragraphs: [
      'Ownfolio LLC provides an online publication and technology platform offering portfolio tracking tools, market data, analytics, charts, screens, educational materials, and related commentary for informational and educational purposes only. All content is published in impersonal form and is intended for general circulation. No content on the service is tailored to the investment objectives, financial circumstances, tax position, risk tolerance, time horizon, liquidity needs, or suitability profile of any particular user.',
      'The service and all content made available through it are not intended to provide, and shall not be construed as providing, investment advisory services, personalized investment advice, legal advice, tax advice, accounting advice, brokerage services, or financial planning services. References to specific securities, issuers, sectors, asset classes, industries, strategies, themes, or market developments are part of a general publication only and do not constitute a recommendation, offer, solicitation, endorsement, or advice concerning the advisability of any investment or transaction.',
    ],
  },
  {
    heading: "Publisher's Exclusion Position",
    paragraphs: [
      "Ownfolio intends its content to qualify as a bona fide business or financial publication of general and regular circulation within the meaning of Section 202(a)(11)(D) of the Investment Advisers Act of 1940. The Supreme Court has explained that the exclusion is directed to impersonal publications offered to the general public on a regular basis, rather than individualized advice attuned to any specific portfolio or client need.",
      "Nothing in the service shall be interpreted to mean that Ownfolio evaluates whether any security, strategy, allocation, or transaction is appropriate for any specific user. Ownfolio does not undertake to provide advice on the basis of any user's specific investment situation and does not assume any duty to update any user as to changed market conditions or personal circumstances.",
    ],
  },
  {
    heading: 'No Advisory Relationship',
    paragraphs: [
      'Use of the service, including the creation of an account, receipt of alerts, use of tracking tools, review of analytics, or submission of portfolio information, does not create an investment adviser-client relationship, fiduciary relationship, broker-customer relationship, agency relationship, or any other advisory or special relationship between Ownfolio and any user. Ownfolio does not accept discretionary authority over any account and does not execute transactions, custody assets, or provide ongoing individualized advice.',
      "Any data input by a user is processed solely to operate the site's tools and present standardized outputs requested by the user. The resulting displays, alerts, analytics, and summaries are automated, rules-based outputs and should not be understood as individualized recommendations or monitoring services.",
    ],
  },
  {
    heading: 'Data; Performance; User Responsibility',
    paragraphs: [
      'The service may rely on third-party data sources, market feeds, pricing vendors, and other external content providers. Ownfolio does not warrant that any quote, price, corporate action, metric, performance figure, or other data point is accurate, complete, current, or available in real time. Delays, omissions, interruptions, and errors may occur.',
      'Any historical data, model output, backtested result, hypothetical result, or performance presentation is for informational purposes only and is not indicative of future results. Investment decisions involve risk, including the risk of loss of principal and loss of opportunity. Each user remains solely responsible for evaluating any investment, strategy, or transaction and for obtaining professional advice where appropriate.',
    ],
  },
  {
    heading: 'No Liability; User Acknowledgment',
    paragraphs: [
      'To the fullest extent permitted by law, Ownfolio disclaims liability for any loss, damage, cost, or expense arising out of or related to use of, or reliance on, the service or any content made available through the service, including any trading loss, tax consequence, missed opportunity, data error, delay, omission, interruption, or systems issue.',
      'By using the service, the user acknowledges that Ownfolio provides a general, impersonal publication and technology tool, not individualized investment advice, and that the user is solely responsible for all investment and financial decisions.',
    ],
  },
] as const
