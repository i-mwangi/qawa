# HashConnect Initialization Troubleshooting Guide

This guide helps resolve the most common issue: HashConnect getting stuck during initialization.

## Common Initialization Problems

### 1. **Infinite "Initializing HashConnect..." Status**

**Symptoms**: 
- Status message stays on "Initializing HashConnect..." indefinitely
- Connect button never becomes enabled
- No error messages in UI

**Root Causes**:
1. CDN libraries failing to load
2. Network connectivity issues
3. Browser security restrictions
4. Ad blockers or privacy extensions
5. Incorrect Project ID
6. Missing Buffer polyfill

## Step-by-Step Solutions

### Step 1: Check Browser Console
1. Press **F12** to open Developer Tools
2. Click on the **Console** tab
3. Look for error messages like:
   - `ReferenceError: HashConnect is not defined`
   - `ReferenceError: Buffer is not defined`
   - `Network error` or `Failed to load resource`

### Step 2: Verify Internet Connection
1. Ensure you have a stable internet connection
2. Try loading other websites
3. Check if CDN URLs are accessible:
   - https://unpkg.com/@hashgraph/sdk@2.41.0/dist/index.web.js
   - https://unpkg.com/hashconnect@3.0.13/dist/hashconnect.js
   - https://unpkg.com/buffer@6.0.3/index.js

### Step 3: Disable Browser Extensions
1. Temporarily disable ad blockers
2. Disable privacy extensions (Privacy Badger, Ghostery, etc.)
3. Disable script blockers
4. Try in Incognito/Private mode

### Step 4: Check Project ID
1. Ensure you're using a valid Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. The placeholder ID `39948bbdaaebec2790629f3e9589793a` is for testing only
3. Get your own Project ID for production use

### Step 5: Refresh and Retry
1. Press **Ctrl+F5** (Windows) or **Cmd+Shift+R** (Mac) to force refresh
2. Click "Initialize HashConnect" again
3. Wait up to 30 seconds for initialization

### Step 6: Use the Debug Version
1. Open [debug-example.html](debug-example.html)
2. Click "Run Diagnostics" to check library status
3. Click "Initialize HashConnect" and monitor the debug output

## Advanced Troubleshooting

### Network Issues
If CDN libraries aren't loading:
```javascript
// Try alternative CDN sources
// jsDelivr CDN:
https://cdn.jsdelivr.net/npm/@hashgraph/sdk@2.41.0/dist/index.web.js
https://cdn.jsdelivr.net/npm/hashconnect@3.0.13/dist/hashconnect.js
https://cdn.jsdelivr.net/npm/buffer@6.0.3/index.js

// Or download libraries locally and serve them
```

### Buffer Polyfill Issues
If Buffer is not defined:
```javascript
// Add this after loading the buffer library:
if (typeof window.Buffer === 'undefined' && typeof buffer !== 'undefined') {
    window.Buffer = buffer.Buffer;
}
```

### Timeout Issues
Add explicit timeouts to initialization:
```javascript
const initWithTimeout = Promise.race([
    hc.init(),
    new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timeout')), 15000)
    )
]);

await initWithTimeout;
```

## Browser-Specific Solutions

### Chrome
1. Check if site is blocked by extensions
2. Clear browser cache: **Ctrl+Shift+Delete**
3. Try disabling "Predict network actions" in settings

### Firefox
1. Check Tracking Protection settings
2. Disable "Enhanced Tracking Protection" for the site
3. Clear cache and cookies

### Safari
1. Disable "Prevent cross-site tracking"
2. Enable "Develop" menu and check for errors
3. Try disabling "Intelligent Tracking Prevention"

### Edge
1. Check if site is in "Tracking prevention" list
2. Try "InPrivate" browsing mode
3. Clear browsing data

## Code-Level Fixes

### Add Retry Logic
```javascript
async function initializeWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await hc.init();
            return true;
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
```

### Add Detailed Error Handling
```javascript
hc.init().then(() => {
    console.log('HashConnect initialized successfully');
}).catch(error => {
    console.error('HashConnect initialization failed:', error);
    // Show user-friendly error message
});
```

## Prevention Tips

1. **Always use your own Project ID** from WalletConnect Cloud
2. **Test in multiple browsers** during development
3. **Implement proper error handling** in your code
4. **Add loading indicators** for better UX
5. **Provide clear user instructions** for wallet setup
6. **Log initialization steps** for debugging

## When to Contact Support

Contact support if:
1. All troubleshooting steps fail
2. You see specific error codes
3. The issue persists across different browsers
4. You suspect a library bug

Support resources:
- [HashConnect GitHub Issues](https://github.com/Hashpack/hashconnect/issues)
- [Hedera SDK Documentation](https://docs.hedera.com/)
- [WalletConnect Support](https://walletconnect.com/)

## Quick Reference Checklist

- [ ] Internet connection stable
- [ ] Browser extensions disabled
- [ ] Valid Project ID used
- [ ] CDN URLs accessible
- [ ] Buffer polyfill loaded
- [ ] Console errors checked
- [ ] Page force-refreshed
- [ ] Debug version tested

Following these steps should resolve most HashConnect initialization issues. The debug version includes enhanced logging to help identify the specific cause of initialization problems.