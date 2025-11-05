import { Readable } from 'stream'
import { getLmdb } from './lmdb-shim'
const lmdb: any = getLmdb()

export interface StreamOptions {
    start_slot?: string
    end_slot?: string
    pollInterval?: number
    batchSize?: number
}

export class StoreReadStream extends Readable {
    private options: StreamOptions
    private env: any
    private dbi: any
    private last_key: string | null = null
    private isReading = false
    private _closed = false

    constructor(
        env: any,
        dbi: any,
        options: StreamOptions = {}
    ) {
        super({ objectMode: true })
        this.env = env
        this.dbi = dbi
        this.options = {
            pollInterval: 1000,
            batchSize: 100,
            ...options,
        }
        this.last_key = options.start_slot || null
    }

    async _read() {
        if (this.isReading) return
        this.isReading = true
        await this.readNextBatch()
    }

    private async readNextBatch() {
        const txn = this.env.beginTxn({ readOnly: true })
        const cursor = new lmdb.Cursor(txn, this.dbi)
        let count = 0

        try {
            // Determine the starting position
            let found: any
            if (this.last_key) {
                // Resume after the last key
                if (cursor.goToKey(this.last_key)) {
                    found = cursor.goToNext() // skip the last one
                } else {
                    found = cursor.goToFirst()
                }
          } else {
              found = this.options.start_slot ? cursor.goToKey(this.options.start_slot) : cursor.goToFirst()
          }

            if (!found) {
                this.finishBatch(cursor, txn)
                return this.schedulePoll()
            }

            while (found) {
                const key = found
              const v = cursor.getCurrentString()
              const value: any = v ? JSON.parse(v) : null
              this.last_key = key

              // Push the entry and respect backpressure
              const canContinue = this.push({ key, value })
              count++
              if (!canContinue) break

              found = cursor.goToNext()
                if (count >= this.options.batchSize!) break
            }

            this.finishBatch(cursor, txn)
            // If we read a full batch, assume there might be more immediately.
            if (count < this.options.batchSize!) {
                return this.schedulePoll()
            }
        } catch (e) {
            cursor.close()
            txn.abort()
            this.emit('error', e)
        }
    }

    private finishBatch(cursor: any, txn: any) {
        cursor.close()
        txn.abort()
        this.isReading = false
    }

    // Schedule a single poll if no data is available.
    private schedulePoll() {
        if (this._closed) return
        setTimeout(() => {
            this._read()
        }, this.options.pollInterval)
    }

    _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
        this._closed = true
        callback(error)
    }

    // Async iterator for sequential processing
    async *iterator(): AsyncGenerator<{ key: string; value: any }, void, unknown> {
        while (!this._closed) {
            const chunk = this.read()
            if (chunk !== null) {
                yield chunk
            } else {
                await new Promise((resolve) => this.once('readable', resolve))
            }
        }
    }
}
