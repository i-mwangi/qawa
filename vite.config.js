import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    root: 'frontend',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2020',
      commonjsOptions: {
        include: [/@hashgraph/, /@walletconnect/, /@reown/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'frontend/index.html'),
          app: path.resolve(__dirname, 'frontend/app.html'),
          groveTracker: path.resolve(__dirname, 'frontend/grove-tracker.html'),
        },
        output: {
          format: 'es',
          manualChunks: undefined, // Disable manual chunking to avoid circular dependency issues
          // Optimize chunk loading
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Enable compression but keep it simple
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Keep console logs for debugging
          drop_debugger: true,
          pure_funcs: [], // Don't remove any functions
        },
        mangle: false, // Disable name mangling to avoid issues
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'frontend/src'),
        '@reown/appkit/adapters': path.resolve(__dirname, 'frontend/mock/adapters.js'),
      },
    },
    optimizeDeps: {
      include: [
        '@hashgraph/sdk',
        '@hashgraph/hedera-wallet-connect',
        '@walletconnect/sign-client',
        '@walletconnect/universal-provider',
        '@walletconnect/utils',
        '@reown/appkit',
        '@reown/appkit-core',
      ],
      esbuildOptions: {
        target: 'es2020',
      },
      exclude: ['@hashgraph/sdk'], // Exclude from optimization to avoid circular deps
      force: true,
    },
    define: {
      'process.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(env.VITE_WALLETCONNECT_PROJECT_ID),
      'process.env.VITE_HEDERA_NETWORK': JSON.stringify(env.VITE_HEDERA_NETWORK),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'process.env': '{}',
    },
  };
});
