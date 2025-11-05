/**
 * Environment Setup
 * This file should be imported at the very top of the main server file.
 */

import 'dotenv/config';
import '../loadIntoEnv';

// Handle JSON-formatted private keys from .env immediately after loading
if (process.env.HEDERA_OPERATOR_KEY && process.env.HEDERA_OPERATOR_KEY.includes('{')) {
    const keyObject = JSON.parse(process.env.HEDERA_OPERATOR_KEY);
    process.env.HEDERA_OPERATOR_KEY = keyObject.privateKey;
}