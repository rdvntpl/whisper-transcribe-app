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

const insertJob = db.prepare(`
  INSERT INTO transcriptions (user_id, original_filename, duration_seconds, mode, model, status)
  VALUES (?, ?, ?, ?, ?, 'processing')
`)
const markDone = db.prepare(`
  UPDATE transcriptions SET status = 'done', text = ?, segments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`)
const markFailed = db.prepare(`
  UPDATE transcriptions SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`)
const getJobStmt = db.prepare(`
  SELECT id, original_filename, duration_seconds, mode, model, text, segments, status, error, created_at, updated_at
  FROM transcriptions WHERE id = ? AND user_id = ?
`)
const listTranscriptions = db.prepare(`
  SELECT id, original_filename, duration_seconds, mode, model, text, segments, status, error, created_at, updated_at
  FROM transcriptions WHERE user_id = ? ORDER BY id DESC LIMIT 50
`)
const countProcessingStmt = db.prepare(`
  SELECT COUNT(*) AS c FROM transcriptions WHERE user_id = ? AND status = 'processing'
`)

// `segments` is stored as a JSON string; parse it back into an array for API
// responses (falls back to null for older rows / stdout-only results with none).
function withParsedSegments(row) {
	if (!row) return row
	let segments = null
	if (row.segments) {
		try {
			segments = JSON.parse(row.segments)
		} catch {
			segments = null
		}
	}
	return { ...row, segments }
}

// Transcription on CPU can take far longer than any HTTP/tunnel timeout allows
// (e.g. a 13 min file on the "small" model can take 15-20+ min of CPU time).
// So POST / only validates the upload and kicks off a background job, returning
// immediately; the client polls GET /jobs/:id for status and the final result.
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

	if (countProcessingStmt.get(req.user.id).c > 0) {
		cleanup()
		return res.status(409).json({ error: 'You already have a transcription in progress. Please wait for it to finish.' })
	}

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

		const info = insertJob.run(req.user.id, file.originalname, durationSeconds, mode, plan.model)
		const jobId = info.lastInsertRowid

		// Respond immediately - actual transcription runs in the background below.
		res.status(202).json({
			jobId,
			status: 'processing',
			durationSeconds,
			model: plan.model,
			mode,
		})

		transcribeAudio(workingPath, { model: plan.model, translate: mode === 'translate' })
			.then(({ text, segments }) => {
				markDone.run(text, segments ? JSON.stringify(segments) : null, jobId)
				addUsageSeconds(req.user.id, durationSeconds)
			})
			.catch(err => {
				console.error('[transcribe] job', jobId, 'failed:', err)
				markFailed.run('Transcription failed. Please try a different file or try again.', jobId)
			})
			.finally(cleanup)
	} catch (err) {
		console.error('[transcribe] failed to start job:', err)
		cleanup()
		res.status(500).json({ error: 'Could not start transcription. Please try a different file or try again.' })
	}
})

// GET /api/transcribe/jobs/:id - poll for job status/result.
router.get('/jobs/:id', requireAuth, (req, res) => {
	const job = withParsedSegments(getJobStmt.get(req.params.id, req.user.id))
	if (!job) return res.status(404).json({ error: 'Job not found' })

	res.json({
		...job,
		usageSeconds: job.status === 'done' ? getMonthlyUsageSeconds(req.user.id) : undefined,
	})
})

router.get('/history', requireAuth, (req, res) => {
	res.json({ items: listTranscriptions.all(req.user.id).map(withParsedSegments) })
})

module.exports = { router }
