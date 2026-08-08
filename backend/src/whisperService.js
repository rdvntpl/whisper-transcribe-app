const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile } = require('child_process')
const { nodewhisper } = require('nodejs-whisper')

const MODEL_ROOT = process.env.WHISPER_MODEL_ROOT || path.join(os.tmpdir(), 'whisper-models')

function ffprobeDurationSeconds(filePath) {
	return new Promise((resolve, reject) => {
		execFile(
			'ffprobe',
			['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
			(err, stdout) => {
				if (err) return reject(err)
				const seconds = parseFloat(String(stdout).trim())
				if (!Number.isFinite(seconds)) return reject(new Error('Could not determine audio duration'))
				resolve(seconds)
			}
		)
	})
}

// whisper.cpp prints "[00:00:00.000 --> 00:00:02.480]   text" lines to stdout.
const STDOUT_LINE_RE = /^\[(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\]\s*(.*)$/

function timeToSeconds(h, m, s, ms) {
	return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000
}

// Parses whisper.cpp's raw stdout into timestamped segments (used when the
// JSON sidecar file isn't available for some reason). Also derives the plain
// joined text so callers always have both representations.
function parseStdout(raw) {
	const segments = []
	for (const line of String(raw).split('\n')) {
		const match = line.match(STDOUT_LINE_RE)
		if (!match) continue
		const [, h0, m0, s0, ms0, h1, m1, s1, ms1, text] = match
		const cleanText = text.trim()
		if (!cleanText) continue
		segments.push({
			start: timeToSeconds(h0, m0, s0, ms0),
			end: timeToSeconds(h1, m1, s1, ms1),
			text: cleanText,
		})
	}
	return { segments, text: segments.map(s => s.text).join(' ').trim() }
}

// Looks for the JSON sidecar file whisper.cpp writes next to the (converted) wav
// file when outputInJson is requested, since it's a more structured/reliable
// source of the transcript (and per-segment timestamps) than parsing stdout.
function tryReadJsonSidecar(wavPath) {
	const candidates = [`${wavPath}.json`, wavPath.replace(/\.wav$/i, '.json')]
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			try {
				const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
				const segments = (parsed.transcription || [])
					.map(seg => ({
						start: (seg.offsets?.from ?? 0) / 1000,
						end: (seg.offsets?.to ?? 0) / 1000,
						text: String(seg.text || '').trim(),
					}))
					.filter(seg => seg.text)
				const text = segments.map(s => s.text).join(' ').trim()
				fs.unlinkSync(candidate)
				if (text) return { text, language: parsed.result?.language, segments }
			} catch {
				// fall through to stdout parsing
			}
		}
	}
	return null
}

/**
 * Transcribes (or translates-to-English) an audio file using a local whisper.cpp
 * model via nodejs-whisper. Fully offline - no external API calls.
 * Returns { text, language, segments } where segments is a per-line array of
 * { start, end, text } (seconds), so callers can render either plain text or a
 * timestamped line-by-line view.
 */
async function transcribeAudio(filePath, { model, translate = false }) {
	const wavPath = filePath.replace(/\.[^.]+$/, '.wav')

	const rawOutput = await nodewhisper(filePath, {
		modelName: model,
		autoDownloadModelName: model,
		modelRootPath: MODEL_ROOT,
		removeWavFileAfterTranscription: true,
		whisperOptions: {
			outputInJson: true,
			translateToEnglish: translate,
			noGpu: true,
			customFlags:['-t', '4'],
		},
	})

	const fromJson = tryReadJsonSidecar(wavPath) || tryReadJsonSidecar(filePath)
	if (fromJson) return fromJson

	return { ...parseStdout(rawOutput), language: undefined }
}

module.exports = { ffprobeDurationSeconds, transcribeAudio, MODEL_ROOT }
