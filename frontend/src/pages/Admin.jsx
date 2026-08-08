import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'

export default function Admin() {
	const { user, token } = useAuth()
	const [users, setUsers] = useState([])
	const [planIds, setPlanIds] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [busyId, setBusyId] = useState(null)

	async function loadUsers() {
		setLoading(true)
		setError('')
		try {
			const data = await api.adminListUsers(token)
			setUsers(data.users)
		} catch (err) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadUsers()
		api.plans().then(data => setPlanIds(data.plans.map(p => p.id)))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	async function withBusy(userId, fn) {
		setBusyId(userId)
		setError('')
		try {
			await fn()
			await loadUsers()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusyId(null)
		}
	}

	const handlePlanChange = (userId, plan) => withBusy(userId, () => api.adminSetPlan(token, userId, plan))
	const handleResetUsage = userId => withBusy(userId, () => api.adminResetUsage(token, userId))
	const handleToggleAdmin = (userId, nextIsAdmin) =>
		withBusy(userId, () => api.adminSetAdmin(token, userId, nextIsAdmin))
	const handleDelete = userId => {
		if (!window.confirm('Delete this user and all of their transcriptions? This cannot be undone.')) return
		withBusy(userId, () => api.adminDeleteUser(token, userId))
	}

	return (
		<div className="page page-wide">
			<h1>Admin</h1>
			<p>Manage every account: change plans, reset usage, grant admin access, or remove users.</p>
			{error && <div className="error">{error}</div>}

			{loading ? (
				<p>Loading users…</p>
			) : (
				<div className="admin-table-wrap">
					<table className="admin-table">
						<thead>
							<tr>
								<th>Email</th>
								<th>Plan</th>
								<th>Usage (mo)</th>
								<th>Transcriptions</th>
								<th>Admin</th>
								<th>Joined</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{users.map(u => {
								const isBusy = busyId === u.id
								const isSelf = u.id === user.id
								return (
									<tr key={u.id}>
										<td>
											{u.email}
											{isSelf && <span className="you-badge">you</span>}
										</td>
										<td>
											<select
												value={u.plan}
												disabled={isBusy}
												onChange={e => handlePlanChange(u.id, e.target.value)}
											>
												{planIds.map(id => (
													<option key={id} value={id}>
														{id}
													</option>
												))}
											</select>
										</td>
										<td>{(u.usageSecondsThisMonth / 60).toFixed(1)} min</td>
										<td>{u.totalTranscriptions}</td>
										<td>
											<label className="admin-checkbox">
												<input
													type="checkbox"
													checked={u.isAdmin}
													disabled={isBusy || isSelf}
													onChange={e => handleToggleAdmin(u.id, e.target.checked)}
												/>
											</label>
										</td>
										<td>{new Date(u.createdAt).toLocaleDateString()}</td>
										<td className="admin-actions">
											<button
												type="button"
												className="btn-secondary"
												disabled={isBusy}
												onClick={() => handleResetUsage(u.id)}
											>
												Reset usage
											</button>
											<button
												type="button"
												className="btn-danger"
												disabled={isBusy || isSelf}
												onClick={() => handleDelete(u.id)}
											>
												Delete
											</button>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	)
}
