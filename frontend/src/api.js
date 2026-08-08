const API_BASE = '/api'

async function request(path, { method = 'GET', body, token, isFormData = false } = {}) {
	const headers = {}
	if (!isFormData) headers['Content-Type'] = 'application/json'
	if (token) headers['Authorization'] = `Bearer ${token}`

	const res = await fetch(`${API_BASE}${path}`, {
		method,
		headers,
		body: isFormData ? body : body ? JSON.stringify(body) : undefined,
	})

	const contentType = res.headers.get('content-type') || ''
	const data = contentType.includes('application/json') ? await res.json() : null

	if (!res.ok) {
		throw new Error((data && data.error) || `Request failed with status ${res.status}`)
	}
	return data
}

export const api = {
	signup: (email, password) => request('/auth/signup', { method: 'POST', body: { email, password } }),
	login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
	me: token => request('/me', { token }),
	plans: () => request('/plans'),
	setPlan: (token, plan) => request('/plans', { method: 'POST', body: { plan }, token }),
	history: token => request('/transcribe/history', { token }),
	transcribe: (token, formData) => request('/transcribe', { method: 'POST', body: formData, token, isFormData: true }),
}
