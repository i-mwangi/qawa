// Simple server launcher for Windows
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = 'api/server.ts';

console.log('🚀 Starting API server...');
console.log('📁 Server path:', serverPath);

const server = spawn('npx', ['tsx', serverPath], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, SKIP_CUSTOM_MIGRATIONS: 'true' }
});

server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

server.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code);
});
