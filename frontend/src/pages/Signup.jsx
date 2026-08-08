import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
	const { signup } = useAuth()
	const navigate = useNavigate()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)

	async function handleSubmit(e) {
		e.preventDefault()
		setError('')
		setBusy(true)
		try {
			await signup(email, password)
			navigate('/')
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="auth-page">
			<form className="auth-card" onSubmit={handleSubmit}>
				<h2>Create your account</h2>
				{error && <div className="error">{error}</div>}
				<label>
					Email
					<input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
				</label>
				<label>
					Password
					<input
						type="password"
						value={password}
						onChange={e => setPassword(e.target.value)}
						minLength={8}
						required
					/>
				</label>
				<button type="submit" disabled={busy}>
					{busy ? 'Creating account…' : 'Sign up'}
				</button>
				<p>
					You'll start on the <strong>Free</strong> plan — upgrade anytime.
				</p>
				<p>
					Already have an account? <Link to="/login">Log in</Link>
				</p>
			</form>
		</div>
	)
}
