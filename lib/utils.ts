import { randomBytes } from "crypto";

export function generateId(prefix: string) {
    const random = randomBytes(8).toString('hex')

    return `${prefix}_${random}`
}