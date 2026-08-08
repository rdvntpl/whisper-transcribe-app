// Plan definitions for Free / Pro / Plus tiers.
// `model` is the whisper.cpp ggml model used for that tier (bigger model = better accuracy, more CPU/RAM).
// `monthlyMinutes` is the rolling calendar-month transcription budget (in minutes). `Infinity` = unlimited.
// `maxFileMinutes` caps a single upload's duration so one file can't blow past sane CPU/time limits.
const PLANS = {
	free: {
		id: 'free',
		label: 'Free',
		model: 'tiny',
		monthlyMinutes: 10,
		maxFileMinutes: 5,
		price: '$0',
		features: ['Tiny model (fastest, lowest accuracy)', '10 minutes / month', 'Max 5 min per file'],
	},
	pro: {
		id: 'pro',
		label: 'Pro',
		model: 'base',
		monthlyMinutes: 120,
		maxFileMinutes: 30,
		price: '$9/mo',
		features: ['Base model (balanced accuracy)', '120 minutes / month', 'Max 30 min per file'],
	},
	plus: {
		id: 'plus',
		label: 'Plus',
		model: 'small',
		monthlyMinutes: Infinity,
		maxFileMinutes: 60,
		price: '$29/mo',
		features: ['Small model (best accuracy)', 'Unlimited minutes / month', 'Max 60 min per file'],
	},
}

const PLAN_IDS = Object.keys(PLANS)

function getPlan(planId) {
	return PLANS[planId] || PLANS.free
}

// JSON-safe serialization (Infinity isn't valid JSON).
function serializePlan(plan) {
	return {
		...plan,
		monthlyMinutes: Number.isFinite(plan.monthlyMinutes) ? plan.monthlyMinutes : null,
	}
}

module.exports = { PLANS, PLAN_IDS, getPlan, serializePlan }
