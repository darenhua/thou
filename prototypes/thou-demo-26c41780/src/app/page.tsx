'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

type Step = 'email' | 'otp' | 'authenticated'

export default function Home() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoOtp, setDemoOtp] = useState('')
  const [userInfo, setUserInfo] = useState<{
    email: string
    id: string
  } | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: sendError } =
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: 'sign-in',
        })

      if (sendError) {
        setError(sendError.message ?? 'Failed to send OTP')
        setLoading(false)
        return
      }

      // Fetch the demo OTP from our helper endpoint
      const res = await fetch('/api/demo-otp')
      const data = await res.json()
      if (data.otp?.otp) {
        setDemoOtp(data.otp.otp)
      }

      setStep('otp')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: verifyError } =
        await authClient.signIn.emailOtp({
          email,
          otp,
        })

      if (verifyError) {
        setError(verifyError.message ?? 'Invalid OTP')
        setLoading(false)
        return
      }

      if (data?.user) {
        setUserInfo({ email: data.user.email, id: data.user.id })
      }
      setStep('authenticated')
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    setStep('email')
    setEmail('')
    setOtp('')
    setDemoOtp('')
    setUserInfo(null)
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-md px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <svg
                className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {step === 'email' && 'Sign in with OTP'}
              {step === 'otp' && 'Enter your code'}
              {step === 'authenticated' && 'Welcome!'}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {step === 'email' &&
                'Enter your email to receive a one-time password'}
              {step === 'otp' && `We sent a code to ${email}`}
              {step === 'authenticated' && 'You are now signed in'}
            </p>
          </div>

          {/* Step 1: Email Input */}
          {step === 'email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* Step 2: OTP Input */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* Demo banner showing the OTP */}
              {demoOtp && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Demo Mode &mdash; Your OTP code is:
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-widest text-amber-900 dark:text-amber-200">
                    {demoOtp}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="otp"
                  className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  One-time password
                </label>
                <input
                  id="otp"
                  type="text"
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setOtp('')
                  setDemoOtp('')
                  setError('')
                }}
                className="w-full text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Use a different email
              </button>
            </form>
          )}

          {/* Step 3: Authenticated */}
          {step === 'authenticated' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="mb-2 flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">
                    Successfully authenticated!
                  </span>
                </div>
                {userInfo && (
                  <div className="space-y-1 text-sm text-green-700 dark:text-green-400">
                    <p>
                      <span className="font-medium">Email:</span>{' '}
                      {userInfo.email}
                    </p>
                    <p>
                      <span className="font-medium">User ID:</span>{' '}
                      <span className="font-mono text-xs">
                        {userInfo.id}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
          Powered by{' '}
          <a
            href="https://better-auth.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Better Auth
          </a>{' '}
          &middot; Email OTP Demo
        </p>
      </main>
    </div>
  )
}
