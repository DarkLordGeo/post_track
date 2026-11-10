import { Card, CardContent, CardHeader, CardTitle } from '@post-tracker/ui';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/app-shell';
import { PlatformMark } from '@/components/platform';

export const metadata: Metadata = { title: 'Extension' };

const steps = [
  [
    'Build the extension',
    <code key="c" className="font-mono text-xs">
      pnpm --filter @post-tracker/extension build
    </code>,
  ],
  [
    'Open your browser’s extension page',
    <code key="c" className="font-mono text-xs">
      chrome://extensions
    </code>,
  ],
  [
    'Enable Developer mode, then “Load unpacked”',
    <code key="c" className="font-mono text-xs">
      apps/extension/.output/chrome-mv3
    </code>,
  ],
  [
    'Visit a Reddit post and click Track',
    <span key="s">The button appears in each post’s header.</span>,
  ],
] as const;

export default function ExtensionPage() {
  return (
    <>
      <PageHeader
        title="Browser extension"
        description="Track posts directly from the page you are reading."
      />
      <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Install (developer build)</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.map(([title, detail], i) => (
                <li key={title} className="flex gap-3">
                  <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-fg ring-1 ring-border">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-fg">{title}</p>
                    <div className="mt-0.5 text-sm text-fg-muted">{detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Platform support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3">
              <PlatformMark platform="REDDIT" />
              <div>
                <p className="font-medium text-fg">Reddit · available</p>
                <p className="text-fg-muted">
                  New and old Reddit, feeds and post pages. Score and comment counts; Reddit does
                  not publish shares or views.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <PlatformMark platform="X" />
              <div>
                <p className="font-medium text-fg">X · beta</p>
                <p className="text-fg-muted">
                  Timeline and status pages. Likes, replies, reposts and views as shown on the page.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <PlatformMark platform="LINKEDIN" />
              <div>
                <p className="font-medium text-fg">LinkedIn · beta</p>
                <p className="text-fg-muted">
                  Feed and post pages. Reactions, comments and reposts as shown on the page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
