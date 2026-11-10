import { linkedInAdapter } from '@post-tracker/core';
import { runInjector } from '../src/injector';

export default defineContentScript({
  matches: ['*://*.linkedin.com/*'],
  runAt: 'document_idle',
  main() {
    runInjector(linkedInAdapter);
  },
});
