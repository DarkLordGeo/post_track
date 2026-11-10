import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Post Tracker',
    description: 'Track Reddit, X and LinkedIn posts and monitor their engagement over time.',
    permissions: ['storage', 'alarms'],
    host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
  },
});
