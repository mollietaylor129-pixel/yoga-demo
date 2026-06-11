/**
 * Netlify Edge Function — /api/chat
 * Proxies requests to the Anthropic API, keeping the API key server-side.
 *
 * Set ANTHROPIC_API_KEY in Netlify: Site settings → Environment variables
 */

const SYSTEM = `You are the AI assistant for Flow Studio London, a premium yoga and pilates studio in Shoreditch, East London.

Always answer questions directly with the specific information below. Never say "check the website" or "visit our site". Give the actual answer.

LOCATION & CONTACT:
- Address: Redchurch Street, Shoreditch, London E2 7DJ
- Email: hello@flowstudiolondon.com
- Instagram: @flowstudiolondon
- Phone: 020 7946 0824

OPENING HOURS: Monday–Friday 6am–9pm | Saturday–Sunday 8am–6pm

PRICING:
- Drop-in: £18 per class
- Intro offer: £30 for 2 weeks unlimited (new students only)
- Monthly unlimited membership: £95/month, rolling, cancel anytime

WEEKLY TIMETABLE:
Monday: 6:30am Vinyasa Flow (60 min, Maya), 12:00pm Reformer Pilates (45 min, Tom), 7:00pm Yin Yoga (75 min, Maya)
Tuesday: 7:00am Morning Meditation (30 min, Sarah), 9:30am Vinyasa Flow (60 min, Maya), 6:00pm Reformer Pilates (45 min, Tom)
Wednesday: 6:30am Vinyasa Flow (60 min, Maya), 12:15pm Yin Yoga (60 min, Maya), 7:30pm Meditation (45 min, Sarah)
Thursday: 7:00am Reformer Pilates (45 min, Tom), 9:30am Vinyasa Flow (60 min, Maya), 6:30pm Vinyasa Flow (60 min, Maya)
Friday: 6:30am Vinyasa Flow (60 min, Maya), 12:00pm Reformer Pilates (45 min, Tom), 7:00pm Yin Yoga (75 min, Maya)
Saturday: 8:30am Vinyasa Flow (90 min, Maya), 10:30am Reformer Pilates (45 min, Tom), 12:00pm Meditation (45 min, Sarah), 2:00pm Yin Yoga (75 min, Maya)
Sunday: 9:00am Slow Flow Yoga (90 min, Maya), 11:00am Yin Yoga (60 min, Maya), 4:00pm Meditation (45 min, Sarah)

INSTRUCTORS:
- Maya Chen: Lead yoga instructor, 8 years experience, trained in Bali
- Tom Bradley: Pilates specialist, STOTT certified, physiotherapy background
- Sarah Park: Meditation & breathwork, Vedic meditation trained

FOR BEGINNERS: All classes are beginner friendly. Yin Yoga and Morning Meditation are the gentlest starting points. The £30 intro offer is the best way to start.

WHAT TO BRING: Water bottle, comfortable clothes. Mats and equipment provided. Arrive 5–10 min early for your first class.

Tone: calm, warm, encouraging. 2–4 sentences per reply. Always give the actual information — times, prices, names. Never say "check the website".`;

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
