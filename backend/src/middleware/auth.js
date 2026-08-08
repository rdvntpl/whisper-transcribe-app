const { verifyToken } = require('../jwt')
const db = require('../db')

const getUserById = db.prepare('SELECT id, email, plan, is_admin, created_at FROM users WHERE id = ?')

function requireAuth(req, res, next) {
	const header = req.headers.authorization || ''
	const token = header.startsWith('Bearer ') ? header.slice(7) : null

	if (!token) {
		return res.status(401).json({ error: 'Missing Authorization header' })
	}

	try {
		const payload = verifyToken(token)
		const user = getUserById.get(payload.sub)
		if (!user) {
			return res.status(401).json({ error: 'User no longer exists' })
		}
		req.user = user
		next()
	} catch (err) {
		return res.status(401).json({ error: 'Invalid or expired token' })
	}
}

// Must run after requireAuth.
function requireAdmin(req, res, next) {
	if (!req.user || !req.user.is_admin) {
		return res.status(403).json({ error: 'Admin access required' })
	}
	next()
}

module.exports = { requireAuth, requireAdmin }
