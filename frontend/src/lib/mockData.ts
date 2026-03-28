import type { SimEvent, SimMetrics } from "./types";

const baseMetrics: SimMetrics = {
  priceIndex: 0,
  unemploymentRate: 4.2,
  socialUnrest: 0.05,
  businessSurvival: 0.95,
  govApproval: 0.62,
  interestRate: 5.25,
};

let eventCounter = 0;
function makeEvent(
  overrides: Omit<SimEvent, "id" | "timestamp"> & { timestamp?: number },
): SimEvent {
  eventCounter++;
  return {
    id: `evt-${String(eventCounter).padStart(3, "0")}`,
    timestamp: overrides.timestamp ?? Date.now() + eventCounter * 1500,
    ...overrides,
  };
}

export const MOCK_EVENTS: SimEvent[] = [
  // ── Phase 1: Announcement & Assessment (months 1-3) ──
  makeEvent({
    type: "phase_change",
    agentId: "system",
    agentName: "System",
    message: "Phase 1: Policy Announcement & Initial Assessment",
    phase: 1,
    month: 1,
  }),
  makeEvent({
    type: "reaction",
    agentId: "gov-official",
    agentName: "Director Chen",
    message:
      "The 25% steel tariff is now in effect. We expect this to protect domestic producers and create jobs in the steel belt.",
    phase: 1,
    month: 1,
    metrics: { govApproval: 0.64 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "journalist",
    agentName: "Reporter Davis",
    message:
      'BREAKING: Steel tariff signed into law. Industry groups call it "a lifeline." Consumer advocates warn of price hikes.',
    phase: 1,
    month: 1,
  }),
  makeEvent({
    type: "reaction",
    agentId: "corp-exec",
    agentName: "CEO Martinez",
    message:
      "We're running the numbers. Our supply chain is 40% imported steel. This could add $2M to annual costs.",
    phase: 1,
    month: 1,
    metrics: { priceIndex: 1.2 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "steelworker",
    agentName: "Frank Kowalski",
    message:
      "Finally. The mill's been running at half capacity for years. Maybe they'll reopen the second furnace.",
    phase: 1,
    month: 2,
  }),
  makeEvent({
    type: "reaction",
    agentId: "household",
    agentName: "Maria Santos",
    message:
      "I heard car prices might go up? We were planning to buy a new minivan this spring...",
    phase: 1,
    month: 2,
    metrics: { priceIndex: 2.1 },
  }),
  makeEvent({
    type: "price_change",
    agentId: "auto-dealer",
    agentName: "Jim's Auto",
    message:
      "New vehicle prices up 3-5% starting next month. Steel surcharge being passed to consumers.",
    phase: 1,
    month: 2,
    metrics: { priceIndex: 3.8 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "sme-owner",
    agentName: "Aisha Patel",
    message:
      "My construction supply shop is getting hammered. Steel beam costs jumped 18% from our wholesaler overnight.",
    phase: 1,
    month: 3,
    metrics: { priceIndex: 5.2, businessSurvival: 0.92 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "union-rep",
    agentName: "Tony Russo",
    message:
      "The union is cautiously optimistic. If domestic steel demand picks up, we could see 200 new jobs in the district.",
    phase: 1,
    month: 3,
  }),
  makeEvent({
    type: "reaction",
    agentId: "economist",
    agentName: "Prof. Nakamura",
    message:
      "Early models suggest a net negative: for every steel job saved, 3-5 jobs are at risk in downstream manufacturing.",
    phase: 1,
    month: 3,
    metrics: { unemploymentRate: 4.4 },
  }),

  // ── Phase 2: Escalation (months 4-6) ──
  makeEvent({
    type: "phase_change",
    agentId: "system",
    agentName: "System",
    message: "Phase 2: Economic Ripple Effects",
    phase: 2,
    month: 4,
  }),
  makeEvent({
    type: "price_change",
    agentId: "appliance-mfg",
    agentName: "HomeTech Inc.",
    message:
      "Refrigerator and washer prices increased 8%. Raw material costs are unsustainable at current margins.",
    phase: 2,
    month: 4,
    metrics: { priceIndex: 8.4 },
  }),
  makeEvent({
    type: "layoff",
    agentId: "auto-plant",
    agentName: "AutoWorks Detroit",
    message:
      "Announcing 340 layoffs at our assembly plant. Steel costs have made the compact car line unprofitable.",
    phase: 2,
    month: 4,
    metrics: { unemploymentRate: 5.1, socialUnrest: 0.18 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "household-2",
    agentName: "James & Linda Park",
    message:
      "James just got his layoff notice. We have maybe 3 months of savings. The kids need new shoes.",
    phase: 2,
    month: 4,
    metrics: { socialUnrest: 0.22 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "union-rep",
    agentName: "Tony Russo",
    message:
      "This isn't what we were promised. Steel jobs are up 50, but the auto plant just cut 340. We demand a meeting with the trade office.",
    phase: 2,
    month: 5,
    metrics: { socialUnrest: 0.28 },
  }),
  makeEvent({
    type: "price_change",
    agentId: "grocery-store",
    agentName: "FreshMart",
    message:
      "Canned goods up 12% — the cans themselves cost more. Passing along steel packaging surcharges.",
    phase: 2,
    month: 5,
    metrics: { priceIndex: 10.6 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "sme-owner",
    agentName: "Aisha Patel",
    message:
      "I'm burning through my line of credit. If margins don't recover by summer, I'll have to let two people go.",
    phase: 2,
    month: 5,
    metrics: { businessSurvival: 0.84 },
  }),
  makeEvent({
    type: "layoff",
    agentId: "construction-co",
    agentName: "BuildRight LLC",
    message:
      "Pausing 3 housing projects. Steel rebar costs have blown our budgets. 120 workers furloughed.",
    phase: 2,
    month: 6,
    metrics: { unemploymentRate: 5.8, businessSurvival: 0.79 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "gov-official",
    agentName: "Director Chen",
    message:
      "We are monitoring the situation closely. The tariff is achieving its goal of protecting domestic steel production.",
    phase: 2,
    month: 6,
    metrics: { govApproval: 0.44 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "journalist",
    agentName: "Reporter Davis",
    message:
      '"Steel Belt Blues": Approval ratings for the tariff policy drop to 38% as consumer prices surge.',
    phase: 2,
    month: 6,
  }),

  // ── Phase 3: Crisis & Reckoning (months 7-9) ──
  makeEvent({
    type: "phase_change",
    agentId: "system",
    agentName: "System",
    message: "Phase 3: Social Crisis & Policy Reckoning",
    phase: 3,
    month: 7,
  }),
  makeEvent({
    type: "closure",
    agentId: "sme-owner",
    agentName: "Aisha Patel",
    message:
      "After 12 years, I'm closing Patel Construction Supply. Can't compete with these input costs. 8 employees out of work.",
    phase: 3,
    month: 7,
    metrics: { businessSurvival: 0.71, unemploymentRate: 6.2 },
  }),
  makeEvent({
    type: "strike",
    agentId: "union-rep",
    agentName: "Tony Russo",
    message:
      "Auto workers strike at three plants. 2,400 workers walk out demanding wage increases to match inflation.",
    phase: 3,
    month: 7,
    metrics: { socialUnrest: 0.52 },
  }),
  makeEvent({
    type: "protest",
    agentId: "community",
    agentName: "Citizens Coalition",
    message:
      '500 people march downtown: "Tariffs Tax the People." Small business owners join laid-off workers.',
    phase: 3,
    month: 8,
    metrics: { socialUnrest: 0.68, govApproval: 0.31 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "household",
    agentName: "Maria Santos",
    message:
      "I'm at the food bank for the first time. Never thought it would come to this. The prices just kept going up.",
    phase: 3,
    month: 8,
  }),
  makeEvent({
    type: "reaction",
    agentId: "economist",
    agentName: "Prof. Nakamura",
    message:
      "Final analysis: tariff created 800 steel jobs but eliminated ~4,200 downstream. Net GDP impact: -0.3%.",
    phase: 3,
    month: 8,
    metrics: { unemploymentRate: 6.8 },
  }),
  makeEvent({
    type: "protest",
    agentId: "steelworker",
    agentName: "Frank Kowalski",
    message:
      "Even I'm conflicted now. My job's secure but my brother-in-law lost his at the auto plant. The whole town's suffering.",
    phase: 3,
    month: 9,
    metrics: { socialUnrest: 0.74 },
  }),
  makeEvent({
    type: "policy_response",
    agentId: "gov-official",
    agentName: "Director Chen",
    message:
      "The administration is considering a phased tariff reduction and emergency relief for affected workers and businesses.",
    phase: 3,
    month: 9,
    metrics: { govApproval: 0.28 },
  }),
  makeEvent({
    type: "reaction",
    agentId: "journalist",
    agentName: "Reporter Davis",
    message:
      "BREAKING: White House announces tariff review panel. Economists predict full reversal within 6 months.",
    phase: 3,
    month: 9,
  }),
];

export const INITIAL_METRICS: SimMetrics = { ...baseMetrics };

export const POLICY_PRESETS = [
  {
    id: "steel-tariff",
    label: "25% Steel Tariff",
    text: "Effective immediately, a 25% tariff shall be imposed on all imported steel and aluminum products entering the domestic market. This measure aims to protect the domestic steel industry, which has seen a 30% decline in workforce over the past decade due to foreign competition. The tariff applies to raw steel, finished steel products, and aluminum alloys from all trading partners without exception. Domestic steel producers will receive additional tax incentives for capacity expansion. The Department of Commerce will review the tariff's impact quarterly and adjust rates as needed. Affected trading partners may apply for limited exemptions through a formal review process. Revenue generated from the tariff will fund a Steel Belt Revitalization Program targeting communities most impacted by deindustrialization.",
  },
  {
    id: "ubi",
    label: "Universal Basic Income",
    text: "The government will implement a Universal Basic Income program providing $1,000 per month to every adult citizen aged 18 and over, regardless of employment status or income level. The program will be funded through a combination of a 10% value-added tax on non-essential goods, consolidation of existing welfare programs, and a 3% wealth tax on assets exceeding $10 million. Payments will be distributed monthly via direct deposit. The program will be phased in over 12 months, starting with households below the poverty line. The Department of Treasury will oversee implementation and establish fraud prevention measures. An independent review board will assess economic impacts quarterly and recommend adjustments. The program is projected to cost $2.8 trillion annually.",
  },
  {
    id: "rate-hike",
    label: "Interest Rate Hike",
    text: "The Federal Reserve announces an aggressive monetary tightening cycle, raising the federal funds rate by 200 basis points to 7.25%. This extraordinary measure responds to persistent inflation running at 6.8% year-over-year, well above the 2% target. The rate hike takes effect immediately and applies to all new lending. The Fed signals that rates will remain elevated for at least 18 months until inflation returns to target range. Mortgage rates are expected to exceed 9%, and business lending costs will rise proportionally. The Fed will provide forward guidance monthly and stands ready to implement additional hikes if inflation proves stubborn. A special lending facility will be established for community banks serving underbanked populations.",
  },
] as const;
