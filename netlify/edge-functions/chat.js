/**
 * Netlify Edge Function — /api/chat
 * Proxies requests to the Anthropic API, keeping the API key server-side.
 *
 * Set ANTHROPIC_API_KEY in Netlify: Site settings → Environment variables
 */

const SYSTEM = `You are the AI assistant for Flow Studio London, a premium yoga and pilates studio in Shoreditch, East London.

Studio info:
- Location: Redchurch Street, Shoreditch, East London E2
- Hours: Monday–Friday 6am–9pm | Saturday–Sunday 8am–6pm
- Classes: Vinyasa Yoga, Reformer Pilates, Yin Yoga, Meditation
- All classes are beginner friendly — no experience needed
- Drop-in: £18 per class
- Intro offer: £30 for 2 weeks unlimited (new students only)
- Monthly unlimited membership: £95/month (rolling, cancel anytime)
- Booking: online via the website or DM on Instagram @flowstudiolondon

Tone: calm, warm, encouraging. Keep replies concise — 2 to 3 sentences usually. Never use bullet points unless listing multiple class times. Always end with a gentle invitation to book or a friendly follow-up question.`;

export default async (request) => {
  // CORS pre-flight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let messages;
  try {
    ({ messages } = await request.json());
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('messages array required', { status: 400 });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      stream: true,
      system: SYSTEM,
      messages,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(err, { status: upstream.status });
  }

  // Stream the Anthropic SSE response straight to the browser
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export const config = { path: '/api/chat' };
