import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import UsageMeter from '../components/UsageMeter'

const POLL_INTERVAL_MS = 3000
const ACTIVE_JOB_KEY = 'whisper-active-job-id'

// mm:ss for under an hour, hh:mm:ss beyond that.
function formatTimestamp(totalSeconds) {
	const s = Math.max(0, Math.floor(totalSeconds || 0))
	const hh = Math.floor(s / 3600)
	const mm = Math.floor((s % 3600) / 60)
	const ss = s % 60
	const pad = n => String(n).padStart(2, '0')
	return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

// Renders a transcript as either one plain-text block or a line-by-line list
// with a timestamp per segment (falls back to plain text if no segments were
// captured, e.g. older rows from before this feature existed).
function TranscriptView({ text, segments, viewMode }) {
	if (viewMode === 'lines' && segments && segments.length > 0) {
		return (
			<ol className="transcript-lines">
				{segments.map((seg, i) => (
					<li key={i}>
						<span className="transcript-timestamp">
							{formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
						</span>
						<span className="transcript-line-text">{seg.text}</span>
					</li>
				))}
			</ol>
		)
	}
	return <p className="result-text">{text}</p>
}

export default function Dashboard() {
	const { user, token, refreshMe } = useAuth()
	const [file, setFile] = useState(null)
	const [mode, setMode] = useState('transcribe')
	const [result, setResult] = useState(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [job, setJob] = useState(null) // { jobId, durationSeconds, model, mode }
	const [history, setHistory] = useState([])
	const [viewMode, setViewMode] = useState('plain') // 'plain' | 'lines'
	const fileInputRef = useRef(null)
	const pollTimerRef = useRef(null)

	async function loadHistory() {
		try {
			const data = await api.history(token)
			setHistory(data.items)
		} catch {
			// non-fatal
		}
	}

	function stopPolling() {
		if (pollTimerRef.current) {
			clearTimeout(pollTimerRef.current)
			pollTimerRef.current = null
		}
	}

	function pollJob(jobId, meta) {
		stopPolling()

		async function tick() {
			try {
				const data = await api.getJob(token, jobId)
				if (data.status === 'done') {
					setResult({
						text: data.text,
						segments: data.segments,
						model: data.model,
						mode: data.mode,
						durationSeconds: data.duration_seconds,
					})
					setJob(null)
					localStorage.removeItem(ACTIVE_JOB_KEY)
					setBusy(false)
					await refreshMe()
					await loadHistory()
					return
				}
				if (data.status === 'failed') {
					setError(data.error || 'Transcription failed. Please try a different file or try again.')
					setJob(null)
					localStorage.removeItem(ACTIVE_JOB_KEY)
					setBusy(false)
					await loadHistory()
					return
				}
				// still processing - keep polling
				pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
			} catch (err) {
				// Job vanished (e.g. deleted) or a transient network error - stop and surface it.
				setError(err.message)
				setJob(null)
				localStorage.removeItem(ACTIVE_JOB_KEY)
				setBusy(false)
			}
		}

		setJob({ jobId, ...meta })
		setBusy(true)
		tick()
	}

	useEffect(() => {
		loadHistory()
		// Resume polling if a job was still in flight when the page was last open
		// (e.g. the user refreshed mid-transcription) - the job keeps running
		// server-side regardless, this just reconnects the UI to it.
		const savedJobId = localStorage.getItem(ACTIVE_JOB_KEY)
		if (savedJobId) {
			pollJob(savedJobId, {})
		}
		return stopPolling
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	async function handleSubmit(e) {
		e.preventDefault()
		if (!file) return
		setError('')
		setResult(null)
		setBusy(true)
		try {
			const formData = new FormData()
			formData.append('audio', file)
			formData.append('mode', mode)
			const data = await api.transcribe(token, formData)
			localStorage.setItem(ACTIVE_JOB_KEY, data.jobId)
			pollJob(data.jobId, { durationSeconds: data.durationSeconds, model: data.model, mode: data.mode })
			setFile(null)
			if (fileInputRef.current) fileInputRef.current.value = ''
		} catch (err) {
			setError(err.message)
			setBusy(false)
		}
	}

	return (
		<div className="page">
			<h1>Transcribe audio</h1>
			<UsageMeter user={user} />

			<form className="upload-card" onSubmit={handleSubmit}>
				<input
					ref={fileInputRef}
					type="file"
					accept="audio/*,video/*"
					disabled={busy}
					onChange={e => setFile(e.target.files[0])}
				/>
				<div className="mode-toggle">
					<label>
						<input
							type="radio"
							name="mode"
							checked={mode === 'transcribe'}
							disabled={busy}
							onChange={() => setMode('transcribe')}
						/>
						Transcribe (original language)
					</label>
					<label>
						<input
							type="radio"
							name="mode"
							checked={mode === 'translate'}
							disabled={busy}
							onChange={() => setMode('translate')}
						/>
						Translate to English
					</label>
				</div>
				{error && <div className="error">{error}</div>}
				<button type="submit" disabled={!file || busy}>
					{busy ? 'Submitting…' : 'Transcribe'}
				</button>
			</form>

			{job && (
				<div className="job-status">
					<span className="spinner" aria-hidden="true" />
					Transcribing locally{job.durationSeconds ? ` (${(job.durationSeconds / 60).toFixed(1)} min audio)` : ''}
					… this can take a while for longer files. Feel free to leave this page - it'll keep processing and
					pick up right here if you come back.
				</div>
			)}

			{result && (
				<div className="result-card">
					<div className="result-header">
						<h3>Result</h3>
						<div className="view-toggle">
							<button
								type="button"
								className={viewMode === 'plain' ? 'active' : ''}
								onClick={() => setViewMode('plain')}
							>
								Plain text
							</button>
							<button
								type="button"
								className={viewMode === 'lines' ? 'active' : ''}
								disabled={!result.segments || result.segments.length === 0}
								onClick={() => setViewMode('lines')}
							>
								Line by line
							</button>
						</div>
					</div>
					<p className="result-meta">
						Model: <code>{result.model}</code> · Duration: {(result.durationSeconds / 60).toFixed(1)} min
						{result.language ? <> · Detected language: {result.language}</> : null}
					</p>
					<TranscriptView text={result.text} segments={result.segments} viewMode={viewMode} />
				</div>
			)}

			{history.length > 0 && (
				<div className="history">
					<h3>Recent transcriptions</h3>
					<ul>
						{history.map(item => (
							<li key={item.id}>
								<strong>{item.original_filename}</strong> · {(item.duration_seconds / 60).toFixed(1)}{' '}
								min · {item.mode} · {new Date(item.created_at).toLocaleString()}
								{item.status && item.status !== 'done' && (
									<span className={`status-badge status-${item.status}`}>{item.status}</span>
								)}
								{item.status === 'done' && (
									<TranscriptView text={item.text} segments={item.segments} viewMode={viewMode} />
								)}
								{item.status === 'failed' && <p className="result-error">{item.error}</p>}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
