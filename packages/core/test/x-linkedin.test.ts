/**
 * X and LinkedIn require login, so these fixtures are hand-built from their long-standing
 * DOM conventions rather than captured from live pages.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { identifyUrl, linkedInAdapter, linkedInIdToDate, trackPostSchema, xAdapter } from '../src';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('X URLs', () => {
  it.each([
    [
      'https://x.com/NASA/status/1850553412046295193',
      'https://x.com/NASA/status/1850553412046295193',
    ],
    [
      'https://twitter.com/NASA/status/1850553412046295193/photo/1',
      'https://x.com/NASA/status/1850553412046295193',
    ],
    [
      'https://mobile.twitter.com/NASA/status/1850553412046295193?s=20',
      'https://x.com/NASA/status/1850553412046295193',
    ],
    [
      'https://x.com/i/web/status/1850553412046295193',
      'https://x.com/i/status/1850553412046295193',
    ],
  ])('%s', (url, canonical) => {
    expect(identifyUrl(url)).toEqual({
      platform: 'X',
      platformPostId: '1850553412046295193',
      canonicalUrl: canonical,
    });
  });
  it('rejects profiles and timelines', () => {
    expect(identifyUrl('https://x.com/NASA')).toBeNull();
    expect(identifyUrl('https://x.com/home')).toBeNull();
  });
});

const tweet = (opts: { likes?: string; withAnalytics?: boolean } = {}) => `
<article data-testid="tweet">
  <div data-testid="User-Name">
    <a href="/NASA"><span>NASA</span></a>
    <a href="/NASA"><span>@NASA</span></a>
    <a href="/NASA/status/1850553412046295193"><time datetime="2024-10-27T15:00:00.000Z">Oct 27</time></a>
  </div>
  <div data-testid="tweetText">Hello <span>from orbit</span> 🚀</div>
  <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/abc.jpg"></div>
  <div role="group">
    <button data-testid="reply" aria-label="45 Replies. Reply"></button>
    <button data-testid="retweet" aria-label="1,203 reposts. Repost"></button>
    <button data-testid="like" aria-label="${opts.likes ?? '9,876 Likes. Like'}"></button>
    ${opts.withAnalytics === false ? '' : '<a href="/NASA/status/1850553412046295193/analytics" aria-label="250,000 views. View post analytics"></a>'}
  </div>
</article>`;

describe('X extraction', () => {
  it('extracts a tweet with all metrics', () => {
    document.body.innerHTML = tweet();
    const [d] = xAdapter.detectPosts(document);
    expect(d!.anchor.getAttribute('role')).toBe('group');
    const post = xAdapter.extract(d!.element, 'https://x.com/home')!;
    expect(post).toMatchObject({
      platform: 'X',
      platformPostId: '1850553412046295193',
      authorName: 'NASA',
      authorHandle: '@NASA',
      authorUrl: 'https://x.com/NASA',
      contentPreview: 'Hello from orbit 🚀',
      publishedAt: '2024-10-27T15:00:00.000Z',
      metrics: { likes: 9876, comments: 45, shares: 1203, views: 250000 },
      media: [{ type: 'image', url: 'https://pbs.twimg.com/media/abc.jpg' }],
    });
    expect(trackPostSchema.safeParse(post).success).toBe(true);
  });

  it('treats a count-less like button as zero but missing analytics as unavailable', () => {
    document.body.innerHTML = tweet({ likes: 'Like', withAnalytics: false });
    const [d] = xAdapter.detectPosts(document);
    const post = xAdapter.extract(d!.element, 'https://x.com/home')!;
    expect(post.metrics.likes).toBe(0);
    expect(post.metrics.views).toBeNull();
  });
});

describe('LinkedIn URLs', () => {
  it.each([
    [
      'https://www.linkedin.com/feed/update/urn:li:activity:7262900123456789504/',
      '7262900123456789504',
    ],
    [
      'https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A7262900123456789504',
      '7262900123456789504',
    ],
    [
      'https://www.linkedin.com/posts/satyanadella_ai-activity-7262900123456789504-AbCd?utm_source=share',
      '7262900123456789504',
    ],
    [
      'https://www.linkedin.com/feed/update/urn:li:share:7262900123456789000/',
      'share:7262900123456789000',
    ],
  ])('%s', (url, id) => {
    expect(identifyUrl(url)?.platformPostId).toBe(id);
  });
  it('rejects non-post pages', () => {
    expect(identifyUrl('https://www.linkedin.com/feed/')).toBeNull();
    expect(identifyUrl('https://www.linkedin.com/in/someone/')).toBeNull();
  });
  it('decodes the publish time from activity ids', () => {
    expect(linkedInIdToDate('7262900123456789504')).toMatch(/^2024-11-/);
    expect(linkedInIdToDate('12')).toBeNull();
  });
});

describe('LinkedIn extraction', () => {
  it('extracts a feed post', () => {
    document.body.innerHTML = `
      <div data-id="urn:li:activity:7262900123456789504" class="feed-shared-update-v2">
        <div data-urn="urn:li:activity:7262900123456789504">
          <div class="update-components-actor__container">
            <a class="update-components-actor__meta-link" href="https://www.linkedin.com/in/jane-doe?miniProfileUrn=x">
              <span class="update-components-actor__title"><span aria-hidden="true">Jane Doe</span><span class="visually-hidden">Jane Doe</span></span>
            </a>
          </div>
          <div class="update-components-text"><span>Shipping our new  product today!</span></div>
          <ul class="social-details-social-counts">
            <li><span class="social-details-social-counts__reactions-count">1,204</span></li>
            <li><button class="social-details-social-counts__comments" aria-label="87 comments on Jane Doe’s post">87 comments</button></li>
            <li class="social-details-social-counts__item"><button aria-label="12 reposts of Jane Doe’s post">12 reposts</button></li>
          </ul>
          <div class="feed-shared-social-action-bar"><button>Like</button></div>
        </div>
      </div>`;
    const found = linkedInAdapter.detectPosts(document);
    expect(found).toHaveLength(1);
    expect(found[0]!.anchor.className).toContain('social-action-bar');
    const post = linkedInAdapter.extract(found[0]!.element, 'https://www.linkedin.com/feed/')!;
    expect(post).toMatchObject({
      platform: 'LINKEDIN',
      platformPostId: '7262900123456789504',
      canonicalUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:7262900123456789504/',
      authorName: 'Jane Doe',
      authorUrl: 'https://www.linkedin.com/in/jane-doe',
      contentPreview: 'Shipping our new product today!',
      metrics: { likes: 1204, comments: 87, shares: 12, views: null },
    });
    expect(post.publishedAt).toMatch(/^2024-11-/);
    expect(trackPostSchema.safeParse(post).success).toBe(true);
  });

  it('leaves metrics unavailable when the counts bar is absent', () => {
    document.body.innerHTML = `<div data-urn="urn:li:activity:7262900123456789504"><div class="update-components-text">Hi</div></div>`;
    const [d] = linkedInAdapter.detectPosts(document);
    const post = linkedInAdapter.extract(d!.element, 'https://www.linkedin.com/feed/')!;
    expect(post.metrics).toEqual({ likes: null, comments: null, shares: null, views: null });
  });
});
