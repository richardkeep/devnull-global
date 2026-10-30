import {defineConfig} from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://dev-null.sh',
        changeOrigin: true
      }
    }
  }
  // Vite preview inherits server.proxy for local production previews.
});
