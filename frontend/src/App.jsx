import React, { useState, useEffect } from 'react'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auto-login check on app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        }
      } catch (err) {
        console.error('Session verification failed:', err)
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  const handleLoginSuccess = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-[#191919] select-none">
        {/* Minimalist Notion logo spinner */}
        <div className="w-12 h-12 border-2 border-neutral-300 border-t-black dark:border-neutral-700 dark:border-t-white rounded-full animate-spin"></div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-sans font-medium tracking-wide mt-4">Loading Workspace...</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* App views */}
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Auth onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  )
}
