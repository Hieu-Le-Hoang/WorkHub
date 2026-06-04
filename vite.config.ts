import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    base: process.env.NODE_ENV === 'production' ? '/WorkHub/' : '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            output: {
                manualChunks: {
                    // React core
                    'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-is'],
                    // Azure MSAL auth
                    'vendor-msal': ['@azure/msal-browser', '@azure/msal-react'],
                    // Charts
                    'vendor-charts': ['recharts'],
                    // Excel export
                    'vendor-xlsx': ['xlsx-js-style'],
                    // Icons
                    'vendor-icons': ['lucide-react'],
                    // UI utilities
                    'vendor-ui': ['sonner', '@tanstack/react-virtual'],
                },
            },
        },
    },
})
