const { verifyToken } = require('../jwt')
const db = require('../db')

const getUserById = db.prepare('SELECT id, email, plan, created_at FROM users WHERE id = ?')

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

module.exports = { requireAuth }
