export default function UsageMeter({ user }) {
	if (!user) return null
	const { planDetails, usageSeconds } = user
	const usedMinutes = usageSeconds / 60
	const limit = planDetails.monthlyMinutes // null = unlimited
	const pct = limit ? Math.min(100, (usedMinutes / limit) * 100) : 0

	return (
		<div className="usage-meter">
			<div className="usage-meter-header">
				<span>Monthly usage</span>
				<span>
					{usedMinutes.toFixed(1)} / {limit ?? '∞'} min
				</span>
			</div>
			<div className="usage-bar">
				<div
					className="usage-bar-fill"
					style={{ width: limit ? `${pct}%` : '100%', background: limit ? undefined : '#8b5cf6' }}
				/>
			</div>
			<div className="usage-meter-footer">
				Plan: <strong>{planDetails.label}</strong> · Model: <code>{planDetails.model}</code> · Max file:{' '}
				{planDetails.maxFileMinutes} min
			</div>
		</div>
	)
}
