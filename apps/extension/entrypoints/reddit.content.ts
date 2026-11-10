import { redditAdapter } from '@post-tracker/core';
import { runInjector } from '../src/injector';

export default defineContentScript({
  matches: ['*://*.reddit.com/*'],
  runAt: 'document_idle',
  main() {
    runInjector(redditAdapter);
  },
});
