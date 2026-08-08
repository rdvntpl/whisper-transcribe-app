import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import PlanCard from '../components/PlanCard'

export default function Upgrade() {
	const { user, token, refreshMe } = useAuth()
	const [plans, setPlans] = useState([])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		api.plans().then(data => setPlans(data.plans))
	}, [])

	async function handleSelect(planId) {
		setError('')
		setBusy(true)
		try {
			await api.setPlan(token, planId)
			await refreshMe()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="page">
			<h1>Choose your plan</h1>
			<p>Instant plan switching for this self-hosted instance — no payment required.</p>
			{error && <div className="error">{error}</div>}
			<div className="plans-grid">
				{plans.map(plan => (
					<PlanCard key={plan.id} plan={plan} currentPlan={user?.plan} onSelect={handleSelect} busy={busy} />
				))}
			</div>
		</div>
	)
}
