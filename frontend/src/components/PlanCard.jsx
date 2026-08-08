export default function PlanCard({ plan, currentPlan, onSelect, busy }) {
	const isCurrent = plan.id === currentPlan

	return (
		<div className={`plan-card plan-card-${plan.id} ${isCurrent ? 'current' : ''}`}>
			<h3>{plan.label}</h3>
			<div className="plan-price">{plan.price}</div>
			<ul>
				{plan.features.map(f => (
					<li key={f}>{f}</li>
				))}
			</ul>
			<button disabled={isCurrent || busy} onClick={() => onSelect(plan.id)}>
				{isCurrent ? 'Current plan' : `Switch to ${plan.label}`}
			</button>
		</div>
	)
}
