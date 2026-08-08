import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import UsageMeter from '../components/UsageMeter'

export default function Dashboard() {
	const { user, token, refreshMe } = useAuth()
	const [file, setFile] = useState(null)
	const [mode, setMode] = useState('transcribe')
	const [result, setResult] = useState(null)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [history, setHistory] = useState([])
	const fileInputRef = useRef(null)

	async function loadHistory() {
		try {
			const data = await api.history(token)
			setHistory(data.items)
		} catch {
			// non-fatal
		}
	}

	useEffect(() => {
		loadHistory()
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
			setResult(data)
			await refreshMe()
			await loadHistory()
			setFile(null)
			if (fileInputRef.current) fileInputRef.current.value = ''
		} catch (err) {
			setError(err.message)
		} finally {
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
					onChange={e => setFile(e.target.files[0])}
				/>
				<div className="mode-toggle">
					<label>
						<input
							type="radio"
							name="mode"
							checked={mode === 'transcribe'}
							onChange={() => setMode('transcribe')}
						/>
						Transcribe (original language)
					</label>
					<label>
						<input
							type="radio"
							name="mode"
							checked={mode === 'translate'}
							onChange={() => setMode('translate')}
						/>
						Translate to English
					</label>
				</div>
				{error && <div className="error">{error}</div>}
				<button type="submit" disabled={!file || busy}>
					{busy ? 'Transcribing locally… (this can take a bit)' : 'Transcribe'}
				</button>
			</form>

			{result && (
				<div className="result-card">
					<h3>Result</h3>
					<p className="result-meta">
						Model: <code>{result.model}</code> · Duration: {(result.durationSeconds / 60).toFixed(1)} min
						{result.language ? <> · Detected language: {result.language}</> : null}
					</p>
					<p className="result-text">{result.text}</p>
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
								<p>{item.text}</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
