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
// Strip the timestamp prefixes so callers get clean plain text regardless of
// which output-format flags were requested.
function stripTimestamps(raw) {
	return String(raw)
		.split('\n')
		.map(line => line.replace(/^\[[0-9:.\->\s]+\]\s*/, '').trim())
		.filter(Boolean)
		.join(' ')
		.trim()
}

// Looks for the JSON sidecar file whisper.cpp writes next to the (converted) wav
// file when outputInJson is requested, since it's a more structured/reliable
// source of the transcript than parsing stdout.
function tryReadJsonSidecar(wavPath) {
	const candidates = [`${wavPath}.json`, wavPath.replace(/\.wav$/i, '.json')]
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			try {
				const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
				const text = (parsed.transcription || [])
					.map(seg => seg.text)
					.join(' ')
					.replace(/\s+/g, ' ')
					.trim()
				fs.unlinkSync(candidate)
				if (text) return { text, language: parsed.result?.language }
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
		},
	})

	const fromJson = tryReadJsonSidecar(wavPath) || tryReadJsonSidecar(filePath)
	if (fromJson) return fromJson

	return { text: stripTimestamps(rawOutput), language: undefined }
}

module.exports = { ffprobeDurationSeconds, transcribeAudio, MODEL_ROOT }
