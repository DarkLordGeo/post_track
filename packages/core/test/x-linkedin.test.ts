/**
 * X and LinkedIn require login, so these fixtures are hand-built from their long-standing
 * DOM conventions rather than captured from live pages.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('X extraction (2026 logged-out UI, real markup)', () => {
  const fixture = () => readFileSync(join(__dirname, 'fixtures', 'x-2026-loggedout.html'), 'utf8');

  it('detects posts without data-testid and reads the engagement summary', () => {
    document.documentElement.innerHTML = fixture();
    const found = xAdapter.detectPosts(document);
    expect(found).toHaveLength(2);
    expect(found[0]!.anchor.getAttribute('role')).toBe('group');
    const post = xAdapter.extract(found[0]!.element, 'https://x.com/NASA')!;
    expect(post).toMatchObject({
      platformPostId: '2119846862286930036',
      canonicalUrl: 'https://x.com/NASA/status/2119846862286930036',
      authorName: 'NASA',
      authorHandle: '@NASA',
      metrics: { likes: 1584, comments: 159, shares: 211, views: 513811 },
      media: [{ type: 'image', url: 'https://pbs.twimg.com/media/IMG1.jpg' }],
    });
    expect(post.contentPreview).toMatch(/^We had a great time at MAX POWER/);
    // No <time> element: derived from the snowflake id.
    expect(post.publishedAt).toMatch(/^2026-11-0[89]/);
    expect(trackPostSchema.safeParse(post).success).toBe(true);
  });

  it('treats counts omitted from the summary as zero, but missing views as unavailable', () => {
    document.documentElement.innerHTML = fixture();
    const reply = xAdapter.detectPosts(document)[1]!;
    const post = xAdapter.extract(reply.element, 'https://x.com/NASA/status/2119846862286930036')!;
    expect(post.platformPostId).toBe('2119900000000000000');
    expect(post.authorName).toBe('Eddie R');
    expect(post.metrics).toEqual({ likes: 12, comments: 0, shares: 0, views: 1174 });
  });

  it('identifies a single-post page main post from its photo links or the page URL', () => {
    document.body.innerHTML = `<article><div dir="auto">Text only</div><div role="group" aria-label="3 likes"></div></article>`;
    const [d] = xAdapter.detectPosts(document);
    expect(
      xAdapter.identify(d!.element, 'https://x.com/NASA/status/2119846862286930036')
        ?.platformPostId,
    ).toBe('2119846862286930036');
    expect(
      xAdapter.extract(d!.element, 'https://x.com/NASA/status/2119846862286930036')!.metrics.views,
    ).toBeNull();
  });
});

/** Structure observed on linkedin.com (logged in) on 2026-11-11; class names omitted. */
const LI_CARD = `
<div role="list" data-testid="organizationFeed_1035_all">
  <div role="listitem" componentkey="update-card-focusHOUv39nEMbhrTlq1Ih6uS">
    <div>
      <a aria-label="View company: Microsoft" href="https://www.linkedin.com/company/microsoft/"><img src="https://media.licdn.com/dms/image/v2/C560BAQ/company-logo_100_100/logo.png"></a>
      <span>Microsoft</span> <span>1h</span>
      <button aria-label="Open control menu for post by Microsoft"></button>
    </div>
    <p><span data-testid="expandable-text-box">Yesterday, Cal Raleigh and Jake Whittenberg joined me to announce the first 25 nonprofits.</span></p>
    <img src="https://media.licdn.com/dms/image/v2/D4E10AQ/feedshare-shrink_800/photo.jpg">
    <div><span>88 reactions</span></div>
    <div><div>
      <button aria-label="Reaction button state: no reaction"></button>
      <button aria-label="Open reactions menu"></button>
      <button aria-label="Comment"></button>
      <button aria-label="Repost"></button>
    </div><button aria-label="Send"></button></div>
  </div>
</div>`;

describe('LinkedIn extraction (current UI, no ids in the DOM)', () => {
  it('detects cards, anchors to the action bar and extracts what is visible', () => {
    document.body.innerHTML = LI_CARD;
    const [d] = linkedInAdapter.detectPosts(document);
    expect(d!.anchor.querySelector('button[aria-label="Repost"]')).not.toBeNull();
    // Feed card: the id is not in the markup.
    expect(
      linkedInAdapter.identify(d!.element, 'https://www.linkedin.com/company/microsoft/posts/'),
    ).toBeNull();
    const id = linkedInAdapter.parseUrl(
      'https://www.linkedin.com/feed/update/urn:li:share:7262900123456789000/',
    )!;
    const post = linkedInAdapter.extract(
      d!.element,
      'https://www.linkedin.com/company/microsoft/posts/',
      id,
    )!;
    expect(post).toMatchObject({
      platformPostId: 'share:7262900123456789000',
      authorName: 'Microsoft',
      authorUrl: 'https://www.linkedin.com/company/microsoft/',
      metrics: { likes: 88, comments: null, shares: null, views: null },
      media: [
        {
          type: 'image',
          url: 'https://media.licdn.com/dms/image/v2/D4E10AQ/feedshare-shrink_800/photo.jpg',
        },
      ],
    });
    expect(post.contentPreview).toMatch(/^Yesterday, Cal Raleigh/);
    expect(trackPostSchema.safeParse(post).success).toBe(true);
  });

  it('uses the page URL for the main card of a single-post page', () => {
    document.body.innerHTML = LI_CARD;
    const [d] = linkedInAdapter.detectPosts(document);
    expect(
      linkedInAdapter.identify(
        d!.element,
        'https://www.linkedin.com/feed/update/urn:li:activity:7262900123456789504/',
      )?.platformPostId,
    ).toBe('7262900123456789504');
  });

  it('resolves the id from the lazily rendered control menu and closes it again', async () => {
    document.body.innerHTML = LI_CARD;
    const trigger = document.querySelector<HTMLButtonElement>('[aria-label^="Open control menu"]')!;
    trigger.addEventListener('click', () => {
      const open = document.querySelector('[role="menu"]');
      if (open) return open.remove();
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div role="menu"><div role="menuitem">Copy link to post</div>
         <a href="https://www.linkedin.com/preload/embed-modal/?targetUrn=urn%3Ali%3Ashare%3A7262900123456789000">Embed this post</a></div>`,
      );
    });
    const [d] = linkedInAdapter.detectPosts(document);
    const id = await linkedInAdapter.resolveIdentity!(d!.element);
    expect(id).toEqual({
      platform: 'LINKEDIN',
      platformPostId: 'share:7262900123456789000',
      canonicalUrl: 'https://www.linkedin.com/feed/update/urn:li:share:7262900123456789000/',
    });
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});

describe('LinkedIn reposts', () => {
  it('attributes a repost to the original author, not the reposting page', () => {
    document.body.innerHTML = `
      <div role="listitem" componentkey="update-card-abc">
        <a href="https://www.linkedin.com/company/microsoft/" aria-label="View company: Microsoft">Microsoft</a> reposted this
        <a href="https://www.linkedin.com/in/aneeshraman/"><img aria-label="View Aneesh Raman’s profile" src="x.png"></a>
        <button aria-label="Open control menu for post by Aneesh Raman"></button>
        <span data-testid="expandable-text-box">Hello</span><span>176 reactions</span>
      </div>`;
    const [d] = linkedInAdapter.detectPosts(document);
    const id = linkedInAdapter.parseUrl(
      'https://www.linkedin.com/feed/update/urn:li:ugcPost:7523784474699000000/',
    )!;
    const post = linkedInAdapter.extract(
      d!.element,
      'https://www.linkedin.com/company/microsoft/posts/',
      id,
    )!;
    expect(post.authorName).toBe('Aneesh Raman');
    expect(post.authorUrl).toBe('https://www.linkedin.com/in/aneeshraman/');
  });
});

describe('X cards wrapped in role="link" (live profile pages)', () => {
  it('identifies the post when the whole card sits inside a link wrapper', () => {
    document.body.innerHTML = `<div role="link"><article><a href="/NASA"><div>NASA</div></a>
      <a href="/NASA/status/2119846862286930036">Nov 9</a><div dir="auto">Text</div>
      <div role="group" aria-label="1 like"></div></article></div>`;
    const [d] = xAdapter.detectPosts(document);
    expect(xAdapter.identify(d!.element, 'https://x.com/NASA')?.platformPostId).toBe(
      '2119846862286930036',
    );
  });

  it('ignores status links inside a quoted post', () => {
    document.body.innerHTML = `<article><a href="/a/status/1111111111111111111">1h</a>
      <div role="link"><a href="/b/status/2222222222222222222">quoted</a></div>
      <div role="group" aria-label="1 like"></div></article>`;
    const [d] = xAdapter.detectPosts(document);
    expect(xAdapter.identify(d!.element, 'https://x.com/home')?.platformPostId).toBe(
      '1111111111111111111',
    );
  });
});

describe('X video posts', () => {
  it('anchors to the action bar, not the video seek slider', () => {
    document.body.innerHTML = `<article><a href="/NASA/status/2119846862286930036">Nov 9</a>
      <div><video poster="https://pbs.twimg.com/poster.jpg"></video><div role="group" aria-label="Seek slider"></div></div>
      <div role="group" aria-label="99 replies, 409 reposts, 2674 likes, 50 bookmarks, 300000 views">
        <div data-engagement-action="reply"><a aria-label="99 Replies. Reply"></a></div>
      </div></article>`;
    const [d] = xAdapter.detectPosts(document);
    expect(d!.anchor.getAttribute('aria-label')).toMatch(/^99 replies/);
    expect(xAdapter.extract(d!.element, 'https://x.com/NASA')!.metrics).toEqual({
      likes: 2674,
      comments: 99,
      shares: 409,
      views: 300000,
    });
  });
});
