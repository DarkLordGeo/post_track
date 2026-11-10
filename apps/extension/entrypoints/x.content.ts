import { xAdapter } from '@post-tracker/core';
import { runInjector } from '../src/injector';

export default defineContentScript({
  matches: ['*://x.com/*', '*://*.x.com/*', '*://twitter.com/*', '*://*.twitter.com/*'],
  runAt: 'document_idle',
  main() {
    runInjector(xAdapter);
  },
});
