/**
 * Node 18 Polyfill for File API
 * Adds File global that undici expects (available natively in Node 20+)
 */

// @ts-ignore
if (typeof globalThis.File === 'undefined') {
  // Simple File polyfill for Node 18
  class FilePolyfill {
    name: string
    type: string
    
    constructor(bits: any[], name: string, options: any = {}) {
      this.name = name
      this.type = options.type || ''
    }
  }
  
  // @ts-ignore
  globalThis.File = FilePolyfill
  console.log('✅ File API polyfill loaded for Node 18')
}