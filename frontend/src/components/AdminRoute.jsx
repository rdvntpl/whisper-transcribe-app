import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children }) {
	const { user, loading } = useAuth()
	if (loading) return <div className="page">Loading…</div>
	if (!user) return <Navigate to="/login" replace />
	if (!user.isAdmin) return <Navigate to="/" replace />
	return children
}
