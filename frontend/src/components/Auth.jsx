import React, { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'

export default function Auth({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('email') // 'email' or 'otp'
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  // OTP expiration timer and resend cooldown state
  const [otpTimeLeft, setOtpTimeLeft] = useState(300)
  const [resendCooldown, setResendCooldown] = useState(30)

  // Countdown timer effect for active OTP session
  useEffect(() => {
    let interval = null
    if (step === 'otp') {
      interval = setInterval(() => {
        setOtpTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [step])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Resend OTP handler calling backend route with current email
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return
    setLoading(true)
    setMessage({ text: '', type: '' })
    
    try {
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      let data = {}
      try {
        data = await response.json()
      } catch (err) {
        throw new Error(`Server returned invalid response (Status ${response.status}).`)
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to resend verification code.')
      }

      setMessage({ text: 'A new verification code has been sent!', type: 'success' })
      setOtpTimeLeft(300)
      setResendCooldown(30)
      setOtp('')
    } catch (err) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const cardRef = useRef(null)
  const emailInputRef = useRef(null)
  const otpInputRef = useRef(null)
  const headingRef = useRef(null)

  // Initial GSAP intro animation
  useEffect(() => {
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, ease: 'power4.out', delay: 0.2 }
    )
    
    // Kinetic letters split animation for title "NoteForge"
    const heading = headingRef.current
    if (heading) {
      const text = heading.textContent
      heading.innerHTML = text
        .split('')
        .map((char) => `<span class="inline-block letter">${char === ' ' ? '&nbsp;' : char}</span>`)
        .join('')
      
      gsap.fromTo(
        heading.querySelectorAll('.letter'),
        { opacity: 0, y: 15, rotateX: -90 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.8, stagger: 0.05, ease: 'back.out(2)' }
      )
    }
  }, [])

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    if (!email) return
    
    setLoading(true)
    setMessage({ text: '', type: '' })
    
    try {
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      let data = {}
      try {
        data = await response.json()
      } catch (err) {
        throw new Error(`Server returned invalid response (Status ${response.status}). Check server logs.`)
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send verification code.')
      }

      setMessage({ text: 'Verification code sent to email!', type: 'success' })
      setOtpTimeLeft(300)
      setResendCooldown(30)
      
      // Animate transitions to OTP step
      gsap.to(emailInputRef.current, {
        opacity: 0,
        x: -20,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          setStep('otp')
          setTimeout(() => {
            gsap.fromTo(
              otpInputRef.current,
              { opacity: 0, x: 20 },
              { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }
            )
          }, 50)
        }
      })
    } catch (err) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp) return
    
    setLoading(true)
    setMessage({ text: '', type: '' })
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      })
      let data = {}
      try {
        data = await response.json()
      } catch (err) {
        throw new Error(`Server returned invalid response (Status ${response.status}). Check server logs.`)
      }
      
      if (!response.ok) {
        throw new Error(data.detail || 'Invalid or expired verification code.')
      }

      setMessage({ text: 'Access granted. Welcome!', type: 'success' })
      
      // Scale down login card and trigger success hook
      gsap.to(cardRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: 0.5,
        ease: 'power3.in',
        onComplete: () => {
          onLoginSuccess(data.user)
        }
      })
    } catch (err) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 relative bg-white dark:bg-[#191919] select-none overflow-hidden">
      
      <div 
        ref={cardRef} 
        className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden"
      >
        {/* Left Column: Form */}
        <div className="p-8 md:p-12 flex flex-col justify-between border-r border-neutral-100 dark:border-neutral-800">
          <div>
            <h1 
              ref={headingRef} 
              className="text-3xl font-bold tracking-tight text-black dark:text-white uppercase font-sans mb-2"
              style={{ perspective: '1000px' }}
            >
              NoteForge
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 font-sans mb-8">
              Minimalist, passwordless workspace
            </p>
          </div>

          <div className="my-auto py-6">
            {step === 'email' ? (
              <form ref={emailInputRef} onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-black dark:text-white font-sans focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 rounded-lg bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-neutral-300 border-t-white dark:border-neutral-700 dark:border-t-black rounded-full animate-spin"></div>
                  ) : (
                    'Request Verification Code'
                  )}
                </button>
              </form>
            ) : (
              <form ref={otpInputRef} onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      Verification Code
                    </label>
                    {otpTimeLeft > 0 ? (
                      <span className="text-xs font-sans text-[#0071e3] dark:text-[#2f97ff] font-semibold">
                        Expires in {formatTime(otpTimeLeft)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-red-500">
                        Code Expired
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    disabled={otpTimeLeft === 0}
                    placeholder={otpTimeLeft === 0 ? "Expired - please resend code" : "Enter 6-digit code"}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 text-center tracking-widest text-lg font-bold rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || otpTimeLeft === 0}
                  className="w-full py-3 rounded-lg bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-neutral-300 border-t-white dark:border-neutral-700 dark:border-t-black rounded-full animate-spin"></div>
                  ) : (
                    'Verify & Access Workspace'
                  )}
                </button>
                <div className="flex items-center justify-between pt-2 px-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email')
                      setOtp('')
                      setMessage({ text: '', type: '' })
                    }}
                    className="text-neutral-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                  >
                    ← Back to Email
                  </button>
                  
                  {resendCooldown > 0 ? (
                    <span className="text-neutral-400 font-sans">
                      Resend in {resendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="text-[#0071e3] hover:text-[#005bb5] dark:text-[#2f97ff] dark:hover:text-[#0a84ff] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </form>
            )}

            {message.text && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs text-center border font-sans ${
                  message.type === 'success'
                    ? 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-950 text-red-600 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}
          </div>

          <div className="text-xs text-neutral-400 dark:text-neutral-500 font-sans">
            Protected by passwordless SMTP logic.
          </div>
        </div>

        {/* Right Column: Notion Linework Illustration */}
        <div className="hidden md:flex flex-col items-center justify-center p-12 bg-neutral-50 dark:bg-neutral-950 relative overflow-hidden select-none">
          <div className="w-full max-w-[280px] z-10 relative opacity-90 dark:invert">
            {/* Elegant linework Notion-style illustration (Notebook with floating geometric shapes) */}
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
              {/* Ground line */}
              <line x1="20" y1="170" x2="180" y2="170" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
              
              {/* Minimalist Notebook */}
              <rect x="50" y="50" width="80" height="100" rx="4" stroke="black" strokeWidth="2" fill="white" />
              <line x1="70" y1="70" x2="110" y2="70" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="70" y1="90" x2="110" y2="90" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="70" y1="110" x2="100" y2="110" stroke="black" strokeWidth="1.5" strokeLinecap="round" />
              
              {/* Binder Spiral details */}
              <circle cx="44" cy="65" r="4" stroke="black" strokeWidth="1.5" fill="white" />
              <path d="M44 65 H50" stroke="black" strokeWidth="1.5" />
              <circle cx="44" cy="85" r="4" stroke="black" strokeWidth="1.5" fill="white" />
              <path d="M44 85 H50" stroke="black" strokeWidth="1.5" />
              <circle cx="44" cy="105" r="4" stroke="black" strokeWidth="1.5" fill="white" />
              <path d="M44 105 H50" stroke="black" strokeWidth="1.5" />
              <circle cx="44" cy="125" r="4" stroke="black" strokeWidth="1.5" fill="white" />
              <path d="M44 125 H50" stroke="black" strokeWidth="1.5" />
              
              {/* Floating organic curve shape */}
              <path d="M140 60 C150 50, 170 80, 150 90 C130 100, 160 130, 140 140" stroke="black" strokeWidth="1.5" strokeDasharray="3 3" />
              
              {/* Geometric structures */}
              <polygon points="150,110 165,135 135,135" stroke="black" strokeWidth="1.5" strokeLinejoin="round" fill="white" />
              <circle cx="155" cy="50" r="8" stroke="black" strokeWidth="1.5" fill="white" />
              <rect x="25" y="70" width="12" height="12" stroke="black" strokeWidth="1.5" transform="rotate(45 25 70)" fill="white" />
            </svg>
          </div>
          <div className="mt-6 text-center z-10">
            <h4 className="text-sm font-semibold text-black dark:text-white">Workspace Canvas</h4>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[220px] mt-1 mx-auto">
              Your organic notes and geometric structure merge into a single unified space.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
