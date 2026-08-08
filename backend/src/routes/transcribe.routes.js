const express = require('express')
const multer = require('multer')
const fs = require('fs')
const os = require('os')
const path = require('path')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { getPlan } = require('../plans')
const { getMonthlyUsageSeconds, addUsageSeconds } = require('../usage')
const { ffprobeDurationSeconds, transcribeAudio } = require('../whisperService')

const router = express.Router()

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'whisper-uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const upload = multer({
	dest: UPLOAD_DIR,
	limits: { fileSize: 200 * 1024 * 1024 }, // 200MB hard cap regardless of plan
})

const insertTranscription = db.prepare(`
  INSERT INTO transcriptions (user_id, original_filename, duration_seconds, mode, model, text)
  VALUES (?, ?, ?, ?, ?, ?)
`)
const listTranscriptions = db.prepare(`
  SELECT id, original_filename, duration_seconds, mode, model, text, created_at
  FROM transcriptions WHERE user_id = ? ORDER BY id DESC LIMIT 50
`)

router.post('/', requireAuth, upload.single('audio'), async (req, res) => {
	const file = req.file
	const mode = req.body.mode === 'translate' ? 'translate' : 'transcribe'

	if (!file) {
		return res.status(400).json({ error: 'No audio file uploaded (field name: audio)' })
	}

	const plan = getPlan(req.user.plan)
	// Give the temp file a real extension so ffmpeg/ffprobe can sniff the container format.
	const ext = path.extname(file.originalname) || '.audio'
	const workingPath = `${file.path}${ext}`
	fs.renameSync(file.path, workingPath)

	const cleanup = () => fs.existsSync(workingPath) && fs.unlinkSync(workingPath)

	try {
		const durationSeconds = await ffprobeDurationSeconds(workingPath)

		if (durationSeconds > plan.maxFileMinutes * 60) {
			cleanup()
			return res.status(400).json({
				error: `Your ${plan.label} plan allows files up to ${plan.maxFileMinutes} minutes. This file is ${(durationSeconds / 60).toFixed(1)} minutes. Upgrade for longer files.`,
			})
		}

		const usedSeconds = getMonthlyUsageSeconds(req.user.id)
		const limitSeconds = plan.monthlyMinutes * 60
		if (Number.isFinite(limitSeconds) && usedSeconds + durationSeconds > limitSeconds) {
			cleanup()
			return res.status(402).json({
				error: `You've used ${(usedSeconds / 60).toFixed(1)} of ${plan.monthlyMinutes} monthly minutes on the ${plan.label} plan. Upgrade to keep transcribing.`,
			})
		}

		const { text, language } = await transcribeAudio(workingPath, {
			model: plan.model,
			translate: mode === 'translate',
		})

		addUsageSeconds(req.user.id, durationSeconds)
		insertTranscription.run(req.user.id, file.originalname, durationSeconds, mode, plan.model, text)

		res.json({
			text,
			language,
			durationSeconds,
			model: plan.model,
			mode,
			usageSeconds: getMonthlyUsageSeconds(req.user.id),
		})
	} catch (err) {
		console.error('[transcribe] failed:', err)
		res.status(500).json({ error: 'Transcription failed. Please try a different file or try again.' })
	} finally {
		cleanup()
	}
})

router.get('/history', requireAuth, (req, res) => {
	res.json({ items: listTranscriptions.all(req.user.id) })
})

module.exports = { router }
