/**
 * Error thrown for batch-level failures.
 */
export class BatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BatchError'
  }
}

