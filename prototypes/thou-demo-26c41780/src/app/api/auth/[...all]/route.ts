import { auth, migrationPromise } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

// Ensure migrations are complete before handling requests
await migrationPromise

export const { GET, POST } = toNextJsHandler(auth)
