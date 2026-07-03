import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base '/' — custom domain served from the root (noidentityrecords.com)
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
})
