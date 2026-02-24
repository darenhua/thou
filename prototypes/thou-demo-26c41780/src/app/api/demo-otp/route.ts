import { lastOtp, migrationPromise } from '@/lib/auth'
import { NextResponse } from 'next/server'

await migrationPromise

// Demo-only endpoint to retrieve the last OTP
// (since we can't actually send emails in this demo)
export function GET() {
  return NextResponse.json({ otp: lastOtp })
}
