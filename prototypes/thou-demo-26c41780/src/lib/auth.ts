import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db'
import { emailOTP } from 'better-auth/plugins'
import Database from 'better-sqlite3'

// File-based SQLite for demo (survives Next.js hot reloads)
const db = new Database('demo-auth.db')

// Store the last OTP in memory so we can display it in the UI for demo
export let lastOtp: { email: string; otp: string; type: string } | null =
  null

const authConfig: BetterAuthOptions = {
  database: db,
  secret: 'demo-secret-key-at-least-32-characters-long',
  baseURL: 'http://localhost:3000',
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      async sendVerificationOTP({ email, otp, type }) {
        // In a real app, you'd send an email here.
        // For the demo, we store it so the UI can display it.
        console.log(`[DEMO] OTP for ${email}: ${otp} (type: ${type})`)
        lastOtp = { email, otp, type }
      },
    }),
  ],
}

export const auth = betterAuth(authConfig)

// Run migrations on startup (skip if tables already exist)
const migrationPromise = getMigrations(authConfig)
  .then(async ({ runMigrations }) => {
    await runMigrations()
    console.log('[DEMO] Database migrations complete')
  })
  .catch(() => {
    // Tables may already exist from a previous run
    console.log('[DEMO] Database already initialized')
  })

export { migrationPromise }
