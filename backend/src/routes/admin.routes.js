const express = require('express')
const db = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { PLAN_IDS, getPlan, serializePlan } = require('../plans')
const { currentYearMonth } = require('../usage')

const router = express.Router()

router.use(requireAuth, requireAdmin)

// Centralize :id parsing/validation so every handler below gets a clean integer.
router.param('id', (req, res, next, value) => {
	const id = Number(value)
	if (!Number.isInteger(id)) {
		return res.status(400).json({ error: 'Invalid user id' })
	}
	req.targetId = id
	next()
})

const listUsersStmt = db.prepare(
	'SELECT id, email, plan, is_admin, created_at FROM users ORDER BY id ASC'
)
const usageForMonthStmt = db.prepare('SELECT seconds_used FROM usage WHERE user_id = ? AND year_month = ?')
const transcriptionCountStmt = db.prepare('SELECT COUNT(*) AS c FROM transcriptions WHERE user_id = ?')
const findUserStmt = db.prepare('SELECT id, email, plan, is_admin FROM users WHERE id = ?')
const updatePlanStmt = db.prepare('UPDATE users SET plan = ? WHERE id = ?')
const updateAdminStmt = db.prepare('UPDATE users SET is_admin = ? WHERE id = ?')
const resetUsageStmt = db.prepare('UPDATE usage SET seconds_used = 0 WHERE user_id = ? AND year_month = ?')
const adminCountStmt = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1')
const deleteTranscriptionsStmt = db.prepare('DELETE FROM transcriptions WHERE user_id = ?')
const deleteUsageStmt = db.prepare('DELETE FROM usage WHERE user_id = ?')
const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?')

function serializeUser(row) {
	const ym = currentYearMonth()
	const usageRow = usageForMonthStmt.get(row.id, ym)
	const countRow = transcriptionCountStmt.get(row.id)
	return {
		id: row.id,
		email: row.email,
		plan: row.plan,
		planDetails: serializePlan(getPlan(row.plan)),
		isAdmin: !!row.is_admin,
		createdAt: row.created_at,
		usageSecondsThisMonth: usageRow ? usageRow.seconds_used : 0,
		totalTranscriptions: countRow ? countRow.c : 0,
	}
}

// GET /api/admin/users - list every user with plan/usage/activity summary.
router.get('/users', (_req, res) => {
	res.json({ users: listUsersStmt.all().map(serializeUser) })
})

// GET /api/admin/stats - quick counts for the dashboard header.
router.get('/stats', (_req, res) => {
	const totalUsers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
	const totalTranscriptions = db.prepare('SELECT COUNT(*) AS c FROM transcriptions').get().c
	const byPlan = db.prepare('SELECT plan, COUNT(*) AS c FROM users GROUP BY plan').all()
	res.json({ totalUsers, totalTranscriptions, byPlan })
})

// PATCH /api/admin/users/:id/plan - move a user to a different tier.
router.patch('/users/:id/plan', (req, res) => {
	const { plan } = req.body || {}
	if (!PLAN_IDS.includes(plan)) {
		return res.status(400).json({ error: `Plan must be one of: ${PLAN_IDS.join(', ')}` })
	}
	const user = findUserStmt.get(req.targetId)
	if (!user) return res.status(404).json({ error: 'User not found' })

	updatePlanStmt.run(plan, user.id)
	res.json({ user: serializeUser({ ...user, plan }) })
})

// POST /api/admin/users/:id/reset-usage - zero out this month's usage (e.g. goodwill credit).
router.post('/users/:id/reset-usage', (req, res) => {
	const user = findUserStmt.get(req.targetId)
	if (!user) return res.status(404).json({ error: 'User not found' })

	resetUsageStmt.run(user.id, currentYearMonth())
	res.json({ user: serializeUser(user) })
})

// PATCH /api/admin/users/:id/admin - promote/demote admin access.
router.patch('/users/:id/admin', (req, res) => {
	const targetId = req.targetId
	const { isAdmin } = req.body || {}
	const user = findUserStmt.get(targetId)
	if (!user) return res.status(404).json({ error: 'User not found' })

	if (!isAdmin) {
		if (targetId === req.user.id) {
			return res.status(400).json({ error: "You can't remove your own admin access." })
		}
		if (user.is_admin && adminCountStmt.get().c <= 1) {
			return res.status(400).json({ error: 'At least one admin must remain.' })
		}
	}

	updateAdminStmt.run(isAdmin ? 1 : 0, targetId)
	res.json({ user: serializeUser({ ...user, is_admin: isAdmin ? 1 : 0 }) })
})

// DELETE /api/admin/users/:id - remove a user and their data entirely.
router.delete('/users/:id', (req, res) => {
	const targetId = req.targetId
	if (targetId === req.user.id) {
		return res.status(400).json({ error: "You can't delete your own account." })
	}
	const user = findUserStmt.get(targetId)
	if (!user) return res.status(404).json({ error: 'User not found' })

	deleteTranscriptionsStmt.run(targetId)
	deleteUsageStmt.run(targetId)
	deleteUserStmt.run(targetId)
	res.json({ ok: true })
})

module.exports = { router }
