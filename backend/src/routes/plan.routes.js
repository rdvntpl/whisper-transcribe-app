const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { PLANS, PLAN_IDS, serializePlan } = require('../plans')
const { getMonthlyUsageSeconds } = require('../usage')

const router = express.Router()

const updatePlanStmt = db.prepare('UPDATE users SET plan = ? WHERE id = ?')

// Public: list all plans so the Upgrade page can render pricing without auth.
router.get('/', (_req, res) => {
	res.json({ plans: PLAN_IDS.map(id => serializePlan(PLANS[id])) })
})

// Mock upgrade/downgrade - instantly switches the signed-in user's plan.
// No payment processing; this is a self-hosted app behind the user's own tunnel.
router.post('/', requireAuth, (req, res) => {
	const { plan } = req.body || {}

	if (!PLAN_IDS.includes(plan)) {
		return res.status(400).json({ error: `Plan must be one of: ${PLAN_IDS.join(', ')}` })
	}

	updatePlanStmt.run(plan, req.user.id)

	res.json({
		plan,
		planDetails: serializePlan(PLANS[plan]),
		usageSeconds: getMonthlyUsageSeconds(req.user.id),
	})
})

module.exports = { router }
