#!/usr/bin/env node

/**
 * Simple HTTP server for Coffee Tree Platform Frontend
 * Serves static files for the web interface
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.FRONTEND_PORT || 3000;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveFile(filePath, res) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Internal Server Error</h1>');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
        }
    });
}

const server = http.createServer((req, res) => {
    // Quick respond to favicon requests with a tiny SVG to avoid 404 noise
    if (req.url === '/favicon.ico') {
        const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>☕</text></svg>");
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Content-Length': svg.length });
        res.end(svg);
        return;
    }
    
    // Parse URL to separate path from query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

    // Security check - prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1>403 - Forbidden</h1>');
        return;
    }

    // Check if file exists
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // If file doesn't exist, serve app.html for SPA routing (not index.html)
            if (pathname !== '/' && !path.extname(pathname)) {
                filePath = path.join(__dirname, 'app.html');
            }
        }

        serveFile(filePath, res);
    });
});

server.listen(PORT, () => {
    console.log(`Coffee Tree Platform Frontend running on http://localhost:${PORT}`);
    console.log('');
    console.log('Available views:');
    console.log('  Landing Page: http://localhost:' + PORT);
    console.log('  Main Application: http://localhost:' + PORT + '/app.html');
    console.log('  Farmer Portal: Connect wallet as farmer in main app');
    console.log('  Investor Portal: Connect wallet as investor in main app');
    console.log('');
    console.log('Make sure the API server is running on port 3001');
});

// Graceful shutdown
server.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Frontend server closed');
        process.exit(0);
    });
});

server.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Frontend server closed');
        process.exit(0);
    });
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});