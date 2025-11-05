/**
 * Error Recovery Utilities
 * 
 * Provides retry logic, exponential backoff, and error handling utilities
 * for database operations and other critical functions.
 */

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  onRetry?: (attempt: number, error: any) => void
}

export interface ConnectionPoolOptions {
  maxRetries?: number
  retryDelay?: number
  healthCheckInterval?: number
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Promise<T>
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 5000,
    onRetry
  } = options

  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry on the last attempt
      if (attempt === maxRetries - 1) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error)
      }

      console.log(
        `[ErrorRecovery] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
        { error: error instanceof Error ? error.message : String(error) }
      )

      // Wait before retrying
      await sleep(delay)
    }
  }

  // All retries exhausted
  console.error(
    `[ErrorRecovery] All ${maxRetries} retry attempts failed`,
    { error: lastError instanceof Error ? lastError.message : String(lastError) }
  )

  throw lastError
}

/**
 * Retry a function with custom retry logic
 * @param fn - Function to retry
 * @param shouldRetry - Function to determine if error should be retried
 * @param options - Retry options
 * @returns Promise<T>
 */
export async function withConditionalRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any, attempt: number) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 5000,
    onRetry
  } = options

  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        console.log('[ErrorRecovery] Error not retryable, failing immediately')
        throw error
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries - 1) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, error)
      }

      console.log(
        `[ErrorRecovery] Conditional retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
        { error: error instanceof Error ? error.message : String(error) }
      )

      // Wait before retrying
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Execute function with graceful fallback
 * @param fn - Primary function to execute
 * @param fallback - Fallback function or value
 * @param logError - Whether to log errors (default: true)
 * @returns Promise<T>
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T | Promise<T>),
  logError: boolean = true
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (logError) {
      console.warn(
        '[ErrorRecovery] Primary function failed, using fallback',
        { error: error instanceof Error ? error.message : String(error) }
      )
    }

    // Return fallback value or execute fallback function
    if (typeof fallback === 'function') {
      return await (fallback as () => T | Promise<T>)()
    }
    return fallback
  }
}

/**
 * Execute function with timeout
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutError - Error to throw on timeout
 * @returns Promise<T>
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: Error
): Promise<T> {
  return Promise.race([
    fn(),
    sleep(timeoutMs).then(() => {
      throw timeoutError || new Error(`Operation timed out after ${timeoutMs}ms`)
    })
  ])
}

/**
 * Check if error is retryable (transient error)
 * @param error - Error to check
 * @returns boolean
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false

  const errorMsg = error.message || String(error)
  const errorCode = error.code || ''

  // Database connection errors
  const retryablePatterns = [
    /SQLITE_BUSY/i,
    /SQLITE_LOCKED/i,
    /database is locked/i,
    /connection/i,
    /timeout/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i,
    /network/i
  ]

  // Check error message patterns
  for (const pattern of retryablePatterns) {
    if (pattern.test(errorMsg) || pattern.test(errorCode)) {
      return true
    }
  }

  return false
}

/**
 * Check if error is a table not found error
 * @param error - Error to check
 * @returns boolean
 */
export function isTableNotFoundError(error: any): boolean {
  if (!error) return false

  const errorMsg = error.message || String(error)

  const patterns = [
    /no such table/i,
    /table.*not found/i,
    /table.*does not exist/i,
    /relation.*does not exist/i
  ]

  for (const pattern of patterns) {
    if (pattern.test(errorMsg)) {
      return true
    }
  }

  return false
}

/**
 * Log error with context
 * @param context - Context string (e.g., function name)
 * @param error - Error to log
 * @param additionalInfo - Additional information to log
 */
export function logError(
  context: string,
  error: any,
  additionalInfo?: Record<string, any>
): void {
  const errorMsg = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${context}] Error:`, {
    message: errorMsg,
    stack: stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
    ...additionalInfo
  })
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 * @returns Promise<void>
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Connection pool recovery manager
 * Monitors database connection health and attempts recovery
 */
export class ConnectionPoolRecovery {
  private isHealthy: boolean = true
  private lastHealthCheck: number = Date.now()
  private healthCheckInterval: number
  private maxRetries: number
  private retryDelay: number
  private healthCheckTimer?: NodeJS.Timeout

  constructor(options: ConnectionPoolOptions = {}) {
    this.healthCheckInterval = options.healthCheckInterval || 30000 // 30 seconds
    this.maxRetries = options.maxRetries || 3
    this.retryDelay = options.retryDelay || 1000
  }

  /**
   * Start health check monitoring
   * @param healthCheckFn - Function to check database health
   */
  startMonitoring(healthCheckFn: () => Promise<boolean>): void {
    console.log('[ConnectionPoolRecovery] Starting health check monitoring')

    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthy = await healthCheckFn()
        
        if (!healthy && this.isHealthy) {
          console.warn('[ConnectionPoolRecovery] Database connection unhealthy, attempting recovery')
          await this.attemptRecovery(healthCheckFn)
        } else if (healthy && !this.isHealthy) {
          console.log('[ConnectionPoolRecovery] Database connection recovered')
          this.isHealthy = true
        }

        this.lastHealthCheck = Date.now()
      } catch (error) {
        console.error('[ConnectionPoolRecovery] Health check failed:', error)
        if (this.isHealthy) {
          await this.attemptRecovery(healthCheckFn)
        }
      }
    }, this.healthCheckInterval)
  }

  /**
   * Stop health check monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
      console.log('[ConnectionPoolRecovery] Stopped health check monitoring')
    }
  }

  /**
   * Attempt to recover database connection
   * @param healthCheckFn - Function to check database health
   */
  private async attemptRecovery(healthCheckFn: () => Promise<boolean>): Promise<void> {
    this.isHealthy = false

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(`[ConnectionPoolRecovery] Recovery attempt ${attempt}/${this.maxRetries}`)

      try {
        await sleep(this.retryDelay * attempt)
        
        const healthy = await healthCheckFn()
        
        if (healthy) {
          console.log('[ConnectionPoolRecovery] Connection recovered successfully')
          this.isHealthy = true
          return
        }
      } catch (error) {
        console.error(`[ConnectionPoolRecovery] Recovery attempt ${attempt} failed:`, error)
      }
    }

    console.error('[ConnectionPoolRecovery] All recovery attempts failed')
  }

  /**
   * Get current health status
   * @returns boolean
   */
  getHealthStatus(): boolean {
    return this.isHealthy
  }

  /**
   * Get time since last health check
   * @returns number (milliseconds)
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.lastHealthCheck
  }
}
