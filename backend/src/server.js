require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')

const { router: authRouter } = require('./routes/auth.routes')
const { router: meRouter } = require('./routes/me.routes')
const { router: planRouter } = require('./routes/plan.routes')
const { router: transcribeRouter } = require('./routes/transcribe.routes')
const { router: adminRouter } = require('./routes/admin.routes')
const { syncConfiguredAdmins } = require('./admin')

syncConfiguredAdmins()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/me', meRouter)
app.use('/api/plans', planRouter)
app.use('/api/transcribe', transcribeRouter)
app.use('/api/admin', adminRouter)

// Serve the built React app (see Dockerfile - frontend is built into ./public).
const publicDir = path.join(__dirname, '..', 'public')
app.use(express.static(publicDir))
app.get(/^\/(?!api\/).*/, (_req, res) => {
	res.sendFile(path.join(publicDir, 'index.html'))
})

app.use((err, _req, res, _next) => {
	console.error(err)
	res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
	console.log(`Whisper app backend listening on port ${PORT}`)
})
