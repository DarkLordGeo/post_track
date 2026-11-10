import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

// The extension calls the API from its background worker (host permission, so no CORS needed),
// but allow cross-origin access for extension pages and local tooling.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function json(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, { ...init, headers: { ...CORS_HEADERS, ...init.headers } });
}

export function errorResponse(status: number, message: string, details?: unknown) {
  return json({ error: message, details }, { status });
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false as const, response: errorResponse(400, 'Request body must be JSON') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: errorResponse(422, 'Invalid request', parsed.error.issues),
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function appUrl(req: Request) {
  return process.env.APP_URL ?? new URL(req.url).origin;
}
