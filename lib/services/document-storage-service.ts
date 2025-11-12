/**
 * Document Storage Service
 * Handles secure file upload, validation, and storage for funding requests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed file types
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
];

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.docx'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_REQUEST = 5;

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

export interface DocumentMetadata {
    fileName: string;
    fileType: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    fileHash: string;
}

export class DocumentStorageService {
    private uploadsDir: string;

    constructor() {
        // Set uploads directory relative to project root
        this.uploadsDir = path.join(process.cwd(), 'uploads', 'funding-requests');
    }

    /**
     * Validate file before upload
     */
    async validateFile(file: Buffer, fileName: string, mimeType: string): Promise<FileValidationResult> {
        // Check file size
        if (file.length > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
            };
        }

        // Check file extension
        const ext = path.extname(fileName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return {
                valid: false,
                error: `File type ${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
            };
        }

        // Check MIME type
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            return {
                valid: false,
                error: `MIME type ${mimeType} is not allowed`
            };
        }

        // Check if file is empty
        if (file.length === 0) {
            return {
                valid: false,
                error: 'File is empty'
            };
        }

        return { valid: true };
    }

    /**
     * Generate secure storage path
     */
    generateStoragePath(groveId: number, requestId: number, fileName: string, fileHash: string): string {
        const ext = path.extname(fileName);
        const sanitizedName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
        const uniqueFileName = `${sanitizedName}-${fileHash.substring(0, 8)}${ext}`;
        
        return path.join(
            this.uploadsDir,
            groveId.toString(),
            requestId.toString(),
            uniqueFileName
        );
    }

    /**
     * Calculate SHA-256 hash of file
     */
    async calculateHash(file: Buffer): Promise<string> {
        return crypto.createHash('sha256').update(file).digest('hex');
    }

    /**
     * Upload and store document
     */
    async uploadDocument(
        file: Buffer,
        fileName: string,
        mimeType: string,
        fileType: string,
        groveId: number,
        requestId: number
    ): Promise<DocumentMetadata> {
        // Validate file
        const validation = await this.validateFile(file, fileName, mimeType);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Calculate file hash
        const fileHash = await this.calculateHash(file);

        // Generate storage path
        const storagePath = this.generateStoragePath(groveId, requestId, fileName, fileHash);

        // Ensure directory exists
        const dir = path.dirname(storagePath);
        await fs.mkdir(dir, { recursive: true });

        // Write file to disk
        await fs.writeFile(storagePath, file);

        console.log(`[DocumentStorage] File uploaded: ${storagePath}`);

        return {
            fileName,
            fileType,
            fileSize: file.length,
            mimeType,
            storagePath: storagePath.replace(this.uploadsDir, ''), // Store relative path
            fileHash
        };
    }

    /**
     * Retrieve document
     */
    async getDocument(relativePath: string): Promise<Buffer> {
        const fullPath = path.join(this.uploadsDir, relativePath);
        
        // Security check: ensure path is within uploads directory
        const resolvedPath = path.resolve(fullPath);
        const resolvedUploadsDir = path.resolve(this.uploadsDir);
        
        if (!resolvedPath.startsWith(resolvedUploadsDir)) {
            throw new Error('Invalid file path');
        }

        try {
            return await fs.readFile(fullPath);
        } catch (error) {
            throw new Error('File not found');
        }
    }

    /**
     * Delete documents for a request
     */
    async deleteDocuments(groveId: number, requestId: number): Promise<void> {
        const requestDir = path.join(this.uploadsDir, groveId.toString(), requestId.toString());
        
        try {
            await fs.rm(requestDir, { recursive: true, force: true });
            console.log(`[DocumentStorage] Deleted documents for request ${requestId}`);
        } catch (error) {
            console.error(`[DocumentStorage] Error deleting documents:`, error);
            // Don't throw - deletion failure shouldn't block other operations
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(relativePath: string): Promise<boolean> {
        const fullPath = path.join(this.uploadsDir, relativePath);
        
        try {
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(relativePath: string): Promise<{ size: number; mtime: Date }> {
        const fullPath = path.join(this.uploadsDir, relativePath);
        const stats = await fs.stat(fullPath);
        
        return {
            size: stats.size,
            mtime: stats.mtime
        };
    }
}

// Singleton instance
let documentStorageService: DocumentStorageService | null = null;

export function getDocumentStorageService(): DocumentStorageService {
    if (!documentStorageService) {
        documentStorageService = new DocumentStorageService();
    }
    return documentStorageService;
}
