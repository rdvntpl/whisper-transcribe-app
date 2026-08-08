const db = require('./db')

// Emails in ADMIN_EMAILS (comma-separated) are auto-promoted to admin on
// signup/login and at server startup, so redeploys never silently drop admin access.
function getConfiguredAdminEmails() {
	return (process.env.ADMIN_EMAILS || '')
		.split(',')
		.map(e => e.trim().toLowerCase())
		.filter(Boolean)
}

function isConfiguredAdminEmail(email) {
	return getConfiguredAdminEmails().includes(String(email).toLowerCase())
}

// Run once at startup: promote any existing users matching ADMIN_EMAILS.
function syncConfiguredAdmins() {
	const emails = getConfiguredAdminEmails()
	if (!emails.length) return
	const placeholders = emails.map(() => '?').join(',')
	db.prepare(`UPDATE users SET is_admin = 1 WHERE lower(email) IN (${placeholders})`).run(...emails)
}

module.exports = { getConfiguredAdminEmails, isConfiguredAdminEmail, syncConfiguredAdmins }
