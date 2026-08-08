const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db')
const { signToken } = require('../jwt')
const { serializePlan, getPlan } = require('../plans')
const { getMonthlyUsageSeconds } = require('../usage')

const router = express.Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const insertUser = db.prepare('INSERT INTO users (email, password_hash, plan) VALUES (?, ?, ?)')
const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?')

function publicUser(user) {
	const plan = getPlan(user.plan)
	return {
		id: user.id,
		email: user.email,
		plan: user.plan,
		planDetails: serializePlan(plan),
		usageSeconds: getMonthlyUsageSeconds(user.id),
	}
}

router.post('/signup', (req, res) => {
	const { email, password } = req.body || {}

	if (!email || !EMAIL_RE.test(email)) {
		return res.status(400).json({ error: 'Please provide a valid email address' })
	}
	if (!password || password.length < 8) {
		return res.status(400).json({ error: 'Password must be at least 8 characters' })
	}
	if (findByEmail.get(email.toLowerCase())) {
		return res.status(409).json({ error: 'An account with that email already exists' })
	}

	const passwordHash = bcrypt.hashSync(password, 10)
	const info = insertUser.run(email.toLowerCase(), passwordHash, 'free')
	const user = { id: info.lastInsertRowid, email: email.toLowerCase(), plan: 'free' }

	const token = signToken(user)
	res.status(201).json({ token, user: publicUser(user) })
})

router.post('/login', (req, res) => {
	const { email, password } = req.body || {}
	const user = email ? findByEmail.get(email.toLowerCase()) : null

	if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
		return res.status(401).json({ error: 'Invalid email or password' })
	}

	const token = signToken(user)
	res.json({ token, user: publicUser(user) })
})

module.exports = { router, publicUser }
