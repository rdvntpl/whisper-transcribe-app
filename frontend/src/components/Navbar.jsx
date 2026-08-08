import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
	const { user, logout } = useAuth()
	const navigate = useNavigate()

	function handleLogout() {
		logout()
		navigate('/login')
	}

	return (
		<nav className="navbar">
			<Link to="/" className="brand">
				🎙️ Whisper Transcribe
			</Link>
			{user && (
				<div className="nav-right">
					<Link to="/">Dashboard</Link>
					<Link to="/upgrade">Upgrade</Link>
					{user.isAdmin && <Link to="/admin">Admin</Link>}
					<span className={`plan-badge plan-${user.plan}`}>{user.planDetails.label}</span>
					<span className="user-email">{user.email}</span>
					<button className="btn-link" onClick={handleLogout}>
						Log out
					</button>
				</div>
			)}
		</nav>
	)
}
