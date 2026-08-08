const express = require('express')
const { requireAuth } = require('../middleware/auth')
const { publicUser } = require('./auth.routes')

const router = express.Router()

router.get('/', requireAuth, (req, res) => {
	res.json({ user: publicUser(req.user) })
})

module.exports = { router }
