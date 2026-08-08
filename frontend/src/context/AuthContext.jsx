import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
	const [token, setToken] = useState(() => localStorage.getItem('token'))
	const [user, setUser] = useState(null)
	const [loading, setLoading] = useState(true)

	const refreshMe = useCallback(async currentToken => {
		const t = currentToken || token
		if (!t) {
			setUser(null)
			setLoading(false)
			return
		}
		try {
			const data = await api.me(t)
			setUser(data.user)
		} catch {
			localStorage.removeItem('token')
			setToken(null)
			setUser(null)
		} finally {
			setLoading(false)
		}
	}, [token])

	useEffect(() => {
		refreshMe(token)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	function persistSession(newToken, newUser) {
		localStorage.setItem('token', newToken)
		setToken(newToken)
		setUser(newUser)
	}

	async function signup(email, password) {
		const data = await api.signup(email, password)
		persistSession(data.token, data.user)
	}

	async function login(email, password) {
		const data = await api.login(email, password)
		persistSession(data.token, data.user)
	}

	function logout() {
		localStorage.removeItem('token')
		setToken(null)
		setUser(null)
	}

	return (
		<AuthContext.Provider value={{ token, user, loading, signup, login, logout, refreshMe: () => refreshMe(token) }}>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth must be used within AuthProvider')
	return ctx
}
