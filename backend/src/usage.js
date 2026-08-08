const db = require('./db')

function currentYearMonth() {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const getUsageStmt = db.prepare('SELECT seconds_used FROM usage WHERE user_id = ? AND year_month = ?')
const upsertUsageStmt = db.prepare(`
  INSERT INTO usage (user_id, year_month, seconds_used)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id, year_month) DO UPDATE SET seconds_used = seconds_used + excluded.seconds_used
`)

function getMonthlyUsageSeconds(userId) {
	const row = getUsageStmt.get(userId, currentYearMonth())
	return row ? row.seconds_used : 0
}

function addUsageSeconds(userId, seconds) {
	upsertUsageStmt.run(userId, currentYearMonth(), seconds)
}

module.exports = { currentYearMonth, getMonthlyUsageSeconds, addUsageSeconds }
