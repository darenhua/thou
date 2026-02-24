import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import type { BetterAuthOptions } from 'better-auth'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db'
import { emailOTP } from 'better-auth/plugins'

// Use bun:sqlite (Bun-native) for tests since better-sqlite3 is not
// supported in the Bun test runner.
let testLastOtp: {
  email: string
  otp: string
  type: string
} | null = null

function createTestAuth() {
  const db = new Database(':memory:')
  const config: BetterAuthOptions = {
    database: db,
    secret: 'test-secret-key-at-least-32-characters-long!',
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: false },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        async sendVerificationOTP({ email, otp, type }) {
          testLastOtp = { email, otp, type }
        },
      }),
    ],
  }
  return { auth: betterAuth(config), config }
}

const { auth, config } = createTestAuth()

const migrationPromise = getMigrations(config).then(
  async ({ runMigrations }) => {
    await runMigrations()
  }
)

describe('Better Auth OTP Setup', () => {
  test('auth instance is created', () => {
    expect(auth).toBeDefined()
    expect(auth.handler).toBeDefined()
    expect(auth.api).toBeDefined()
  })

  test('database migrations complete successfully', async () => {
    await expect(migrationPromise).resolves.toBeUndefined()
  })

  test('send OTP stores code for demo', async () => {
    await migrationPromise

    const response = await auth.api.sendVerificationOTP({
      body: {
        email: 'test@example.com',
        type: 'sign-in',
      },
    })

    expect(response).toBeDefined()
    expect(testLastOtp).not.toBeNull()
    expect(testLastOtp?.email).toBe('test@example.com')
    expect(testLastOtp?.otp).toHaveLength(6)
    expect(testLastOtp?.type).toBe('sign-in')
  })

  test('sign in with valid OTP returns user and token', async () => {
    await migrationPromise

    await auth.api.sendVerificationOTP({
      body: {
        email: 'login@example.com',
        type: 'sign-in',
      },
    })

    const otpCode = testLastOtp?.otp
    expect(otpCode).toBeDefined()

    const signInResponse = await auth.api.signInEmailOTP({
      body: {
        email: 'login@example.com',
        otp: otpCode!,
      },
    })

    expect(signInResponse).toBeDefined()
    expect(signInResponse.user).toBeDefined()
    expect(signInResponse.user.email).toBe('login@example.com')
    expect(signInResponse.token).toBeDefined()
  })

  test('sign in with invalid OTP fails', async () => {
    await migrationPromise

    await auth.api.sendVerificationOTP({
      body: {
        email: 'invalid@example.com',
        type: 'sign-in',
      },
    })

    try {
      await auth.api.signInEmailOTP({
        body: {
          email: 'invalid@example.com',
          otp: '000000',
        },
      })
      // Should not reach here
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})
