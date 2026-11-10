import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { identifyUrl, redditAdapter, trackPostSchema } from '../src';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('reddit URL handling', () => {
  it.each([
    [
      'https://www.reddit.com/r/programming/comments/1xojg3s/openssh_on_musl/',
      '1xojg3s',
      'https://www.reddit.com/r/programming/comments/1xojg3s/',
    ],
    [
      'https://old.reddit.com/r/programming/comments/1XOJG3S/x/?sort=top',
      '1xojg3s',
      'https://www.reddit.com/r/programming/comments/1xojg3s/',
    ],
    [
      'https://www.reddit.com/r/programming/comments/1xojg3s/slug/abc1234/',
      '1xojg3s',
      'https://www.reddit.com/r/programming/comments/1xojg3s/',
    ],
    ['https://redd.it/1xojg3s', '1xojg3s', 'https://www.reddit.com/comments/1xojg3s/'],
    [
      'https://www.reddit.com/comments/1xojg3s',
      '1xojg3s',
      'https://www.reddit.com/comments/1xojg3s/',
    ],
    [
      'https://www.reddit.com/user/someone/comments/1xojg3s/t/',
      '1xojg3s',
      'https://www.reddit.com/comments/1xojg3s/',
    ],
  ])('%s', (url, id, canonical) => {
    expect(identifyUrl(url)).toEqual({
      platform: 'REDDIT',
      platformPostId: id,
      canonicalUrl: canonical,
    });
  });

  it.each([
    'https://www.reddit.com/r/programming/',
    'https://www.reddit.com/',
    'https://example.com/r/x/comments/abc123/',
    'not a url',
  ])('rejects non-post URL %s', (url) => expect(identifyUrl(url)).toBeNull());
});

describe('reddit extraction (new reddit, real markup)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects every post in a subreddit feed and anchors to the credit bar', () => {
    document.documentElement.innerHTML = fixture('reddit-listing.html');
    const posts = redditAdapter.detectPosts(document);
    expect(posts).toHaveLength(3);
    for (const p of posts) {
      expect(p.anchor.getAttribute('slot')).toBe('credit-bar');
      expect(p.placement).toBe('append');
    }
    const ids = posts.map(
      (p) =>
        redditAdapter.identify(p.element, 'https://www.reddit.com/r/programming/')?.platformPostId,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('extracts link post metadata and metrics', () => {
    document.documentElement.innerHTML = fixture('reddit-listing.html');
    const [first] = redditAdapter.detectPosts(document);
    const post = redditAdapter.extract(
      first!.element,
      'https://www.reddit.com/r/programming/top/',
    )!;
    expect(post).toMatchObject({
      platform: 'REDDIT',
      platformPostId: '1xojg3s',
      canonicalUrl: 'https://www.reddit.com/r/programming/comments/1xojg3s/',
      authorName: 'ThisMachineIs4',
      authorUrl: 'https://www.reddit.com/user/ThisMachineIs4/',
      community: 'r/programming',
      publishedAt: '2026-11-05T14:04:10.276Z',
      metrics: { likes: 714, comments: 98, shares: null, views: null },
    });
    expect(post.title).toContain('openssh on musl');
    expect(post.media[0]).toEqual({ type: 'link', url: 'https://sshhole.com/' });
    expect(trackPostSchema.safeParse(post).success).toBe(true);
  });

  it('extracts the body of a text post on its detail page', () => {
    document.documentElement.innerHTML = fixture('reddit-detail.html');
    const url = 'https://www.reddit.com/r/AskProgramming/comments/1xqkr8d/ai_abstinence/';
    const [detected] = redditAdapter.detectPosts(document);
    const post = redditAdapter.extract(detected!.element, url)!;
    expect(post.platformPostId).toBe('1xqkr8d');
    expect(post.authorName).toBe('cachebags');
    expect(post.contentPreview).toMatch(/^For the last 6 months/);
    expect(post.metrics.likes).not.toBeNull();
    expect(trackPostSchema.safeParse(post).success).toBe(true);
  });

  it('treats deleted authors as unavailable', () => {
    document.body.innerHTML = `<shreddit-post id="t3_1ehf8ks" permalink="/r/x/comments/1ehf8ks/deleted/" author="[deleted]" is-author-deleted="" score="2" comment-count="0"></shreddit-post>`;
    const [d] = redditAdapter.detectPosts(document);
    const post = redditAdapter.extract(d!.element, 'https://www.reddit.com/')!;
    expect(post.authorName).toBeNull();
    expect(post.authorUrl).toBeNull();
    expect(post.metrics.comments).toBe(0);
    expect(d!.placement).toBe('after');
  });
});

describe('reddit extraction (old reddit)', () => {
  it('reads data attributes from .thing rows', () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_abc123" data-subreddit="rust" data-author="ferris"
           data-score="42" data-comments-count="7" data-timestamp="1700000000000" data-url="https://blog.rust-lang.org/">
        <div class="entry"><a class="title" href="#">Rust 2.0 announced</a>
        <ul class="flat-list buttons"><li>share</li></ul></div>
      </div>`;
    const [d] = redditAdapter.detectPosts(document);
    expect(d!.anchor.className).toContain('buttons');
    const post = redditAdapter.extract(d!.element, 'https://old.reddit.com/r/rust/')!;
    expect(post).toMatchObject({
      platformPostId: 'abc123',
      canonicalUrl: 'https://www.reddit.com/r/rust/comments/abc123/',
      title: 'Rust 2.0 announced',
      community: 'r/rust',
      metrics: { likes: 42, comments: 7, shares: null, views: null },
      publishedAt: '2023-11-14T22:13:20.000Z',
    });
  });
});
