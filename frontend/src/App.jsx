import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Upgrade from './pages/Upgrade'
import Admin from './pages/Admin'

export default function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<Navbar />
				<Routes>
					<Route path="/login" element={<Login />} />
					<Route path="/signup" element={<Signup />} />
					<Route
						path="/"
						element={
							<ProtectedRoute>
								<Dashboard />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/upgrade"
						element={
							<ProtectedRoute>
								<Upgrade />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/admin"
						element={
							<AdminRoute>
								<Admin />
							</AdminRoute>
						}
					/>
				</Routes>
			</AuthProvider>
		</BrowserRouter>
	)
}
