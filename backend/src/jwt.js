const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-production'
const JWT_EXPIRES_IN = '30d'

function signToken(user) {
	return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function verifyToken(token) {
	return jwt.verify(token, JWT_SECRET)
}

module.exports = { signToken, verifyToken, JWT_SECRET }
