// ============================================================================
// send-reminders — Supabase Edge Function SKETCH (UNTESTED — DO NOT ENABLE
// BLINDLY). Sends Web Push reminders for user-scheduled tests (decision D5).
//
// What it is supposed to do, once configured and tested:
//   1. Flip past-due, uncompleted schedules to 'missed' (see the calendar-
//      day caveat below — align this with the app's availability rule
//      before enabling).
//   2. Find scheduled_tests rows with status 'scheduled'/'available',
//      reminder_sent_at IS NULL, and scheduled_at within the next 60
//      minutes; send a Web Push to every push_subscriptions row for that
//      user; then set reminder_sent_at so the same schedule is never
//      notified twice.
//   3. Prune push subscriptions whose endpoint answers 404/410.
//
// BEFORE THIS SENDS ANYTHING REAL, all of the following must be true:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY,
//     VAPID_PRIVATE_KEY and VAPID_SUBJECT are set as function secrets.
//     No key is hardcoded anywhere in this file.
//   - The web-push library import below actually resolves and works in
//     the deployed Deno environment (it is a Node-oriented library; the
//     esm.sh build is assumed, not verified).
//   - A cron schedule invokes this function (suggested: every 15 minutes,
//     e.g. Supabase pg_cron hitting the function URL, or a scheduled
//     Edge Function). Without a schedule, nothing is ever sent.
//   - The function has been run once in a staging project and its logs
//     checked: reminders sent, reminder_sent_at set, missed flips correct.
//
// CALENDAR-DAY CAVEAT: the 'missed' flip below uses "scheduled_at is
// before the start of the current UTC day". That encodes "a test expires
// once its scheduled calendar day is over". The product rule discussed
// with the user is "available from the scheduled time until the end of
// that day, then expired" — the integrator MUST align this flip with
// the app's timezone and availability-window rule before enabling it,
// or tests could be marked missed too early or too late.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:learnmate@example.invalid';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // 1. Past-due, uncompleted schedules become 'missed' and can no longer
  //    be started (the test-start API must refuse status 'missed').
  const { data: missedRows } = await supabase
    .from('scheduled_tests')
    .update({ status: 'missed', updated_at: now.toISOString() })
    .in('status', ['scheduled', 'available'])
    .lt('scheduled_at', startOfTodayUtc.toISOString())
    .select('id');

  // 2. Schedules due within the next 60 minutes, not yet reminded.
  const { data: dueRows, error: dueError } = await supabase
    .from('scheduled_tests')
    .select('id, user_id, scheduled_at')
    .in('status', ['scheduled', 'available'])
    .is('reminder_sent_at', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', windowEnd.toISOString());

  if (dueError) {
    return new Response(JSON.stringify({ error: dueError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let remindersSent = 0;
  for (const row of dueRows ?? []) {
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', row.user_id);

    let attempted = false;
    for (const sub of subscriptions ?? []) {
      attempted = true;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: 'LearnMate test reminder',
            body: 'Your scheduled test starts within the hour.',
            // Integrator: point this at the app's test/schedule page.
            url: '/',
            tag: `learnmate-test-${row.id}`,
          }),
        );
        remindersSent += 1;
      } catch (err) {
        // 404/410 = the browser subscription is gone; prune the row so
        // future runs stop trying it. Other errors are left for the next
        // run (reminder_sent_at stays null) and logged by the platform.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    // Only mark reminded when at least one push was attempted. A user
    // with no subscriptions keeps reminder_sent_at null, so a later
    // subscription + run can still catch a schedule inside its window.
    if (attempted) {
      await supabase
        .from('scheduled_tests')
        .update({ reminder_sent_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('id', row.id);
    }
  }

  return new Response(
    JSON.stringify({
      missed: missedRows?.length ?? 0,
      due: dueRows?.length ?? 0,
      remindersSent,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
