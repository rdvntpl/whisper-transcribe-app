// Used only during `docker build` to pre-download a Whisper ggml model and force
// nodejs-whisper to compile whisper.cpp once, so the final image starts instantly
// with no first-request compile/download delay.
//
// The warmup clip is silence, so whisper.cpp legitimately produces an empty
// transcript - nodejs-whisper treats *any* empty result as a thrown error, even
// though the download + compile (the actual point of this script) succeeded. We
// swallow that specific, expected error and only fail the build on a real
// download/compile problem.
const path = require('path')
const { nodewhisper } = require('nodejs-whisper')

const modelName = process.argv[2]
if (!modelName) {
	console.error('Usage: node warmup-model.js <modelName>')
	process.exit(1)
}

const warmupFile = path.join(__dirname, 'warmup.wav')

nodewhisper(warmupFile, {
	modelName,
	autoDownloadModelName: modelName,
	modelRootPath: process.env.WHISPER_MODEL_ROOT,
	removeWavFileAfterTranscription: false,
	whisperOptions: { outputInText: true, noGpu: true },
})
	.then(() => {
		console.log(`[warmup] ${modelName} ready (produced transcript)`)
	})
	.catch(err => {
		if (String(err.message).includes('Transcription failed or produced no output')) {
			console.log(`[warmup] ${modelName} ready (model downloaded + whisper.cpp built; silent test clip produced no text, which is expected)`)
			return
		}
		console.error(`[warmup] ${modelName} FAILED:`, err.message)
		process.exit(1)
	})
