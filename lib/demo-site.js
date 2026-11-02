// Demonstration chrome switch (m1-029, CA-5 checklist B6).
//
// Off unless it is switched on explicitly, so a real-content site (staging,
// production) never shows demonstration text by mistake:
//
//   APOS_DEMO_SITE=1   Development and demo sites. Every page shows the
//                      "Demonstration site" notice, and the footer falls
//                      back to a demonstration line when Global Content has
//                      no copyright name.
//   Unset or 0         Neither is shown.
//
// Invalid values throw at startup (app.js) instead of silently changing what
// visitors see.
export function readDemoSite(env) {
  const value = env.APOS_DEMO_SITE;
  const flag = value === undefined || String(value).trim() === '' ? '0' : String(value).trim();
  if (![ '0', '1' ].includes(flag)) {
    throw new Error('Site configuration: APOS_DEMO_SITE must be 1 (demonstration site) or 0.');
  }
  return flag === '1';
}
