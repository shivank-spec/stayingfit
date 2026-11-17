# Stayingfit: the real app

A browser app made of plain HTML, CSS and JavaScript, with no build step. Logins, data and photos are stored in Supabase, which is free to start.

## How it works

- Anyone who opens the site sees one sign-in form. The login itself decides which screens open.
- Everyone signs in with a **username and password**. There's no sign-up button, so nobody can create their own account.
  - **You** create the coach and assistant logins once, in Supabase (step 5 below).
  - **Pushpanjali** creates each client's login from her dashboard: Clients → Add client. The app then shows a ready-to-send WhatsApp message with the link, username and temporary password.
- The first time anyone signs in, they have to replace the temporary password with their own. That means the password that went over WhatsApp stops working.
- A login only opens its own role's screens. Data access is enforced inside the database, not just in the screens, so even a client who tampers with the page only ever gets their own data back.

| | Client | Assistant | Coach |
|---|---|---|---|
| Sees | Only their own logs, chats and family groups | All clients (read-only) | All clients |
| Can do | Log weight, water, meals, photos, workouts and blood tests; chat | Follow-ups, reply to messages, send renewal reminders | Everything: add/delete clients, reset client passwords, diet plans, renewals, detox |

## Files

| File | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css`, `app.css` | The app |
| `config.js` | **You edit this:** Supabase URL and publishable key |
| `supabase/setup.sql` | The whole database in one file: tables, access rules, login functions, storage |
| `supabase-2.117.2.js` | Supabase library (bundled) |
| `privacy.html` | Privacy notice. **Fill in the highlighted bits** |
| `manifest.webmanifest`, `icon.svg` | Lets people add it to their phone's home screen |

## Setup (about 20 minutes)

1. **Create a Supabase project** at supabase.com (free). Pick region **Mumbai** and save the database password somewhere safe.
2. **Turn off public sign-ups.** Authentication → Sign In / Providers → turn **off** "Allow new users to sign up". Leave the Email provider on.
3. **Build the database.** SQL Editor → New query → paste the whole of `supabase/setup.sql` → Run. It's safe to run again later.
4. **Connect the app.** Project Settings → API Keys. Copy the **Project URL** and the **publishable key** (it starts with `sb_publishable_`; the legacy "anon" key also works) into `config.js`.
   **Never** put the secret / service_role key anywhere in these files.
5. **Make the staff logins.** In the SQL Editor, run (with your own temporary passwords, at least 8 characters):
   ```sql
   select create_staff_login('pushpanjali', 'Wellness@4821', 'coach', 'Pushpanjali');
   select create_staff_login('riya', 'Balance@7390', 'assistant', 'Riya');
   ```
   Send each person their username and temporary password. They choose their own password the first time they sign in.
6. **Put it online (free).** Upload everything in this folder to a GitHub repo, then go to Settings → Pages → deploy from the `main` branch. The address will look like `https://<you>.github.io/<repo>/`. If you like, put that address in `appUrl` in `config.js` so the login messages always use it.
7. **Add clients.** Pushpanjali signs in → Clients → Add client → copies the message → sends it on WhatsApp.

## Everyday admin

- **A client forgot their password:** Pushpanjali opens their profile → Reset password → sends the new message. The old password and any open sessions stop working.
- **Pushpanjali or the assistant forgot theirs:** in the SQL Editor, run `select reset_password('pushpanjali', 'New-temp-123');`
- **The assistant leaves:** `select delete_login('riya');`
- **Add a client from the SQL Editor instead:** `select add_client('anita', 'Temp-pass-1', 'Anita Roy', 82.4, 72, 'Hand-holding', 30);`

## Test before real clients join

- [ ] Sign in as the coach. The app should ask for a new password, then show the dashboard.
- [ ] Add yourself as a test client. Open the link on your phone and sign in. Set your own password, agree to the privacy notice, then log a weight, water, a meal, a photo and a workout, and send a message.
- [ ] Back as the coach, check the Today tab. Your message should be there, plus your weigh-in under Check-ins. Then reply, edit your diet plan, and reset your test client's password.
- [ ] Sign in as the assistant. You should see Follow-ups, Clients, Messages and Renewals, but no Add client, no Diet plans tab and no Delete.
- [ ] Sign in again with the test client's login. Only the client screens should open.
- [ ] Fill in `privacy.html` and have Pushpanjali read it.

## Looking after it

All of these run in the Supabase SQL Editor. Nothing here is reachable from the app itself.

- **Nightly backup.** Every night at 2:00 am India time the database copies every table into `private.backups` (one row per table per day). It keeps the last seven days and the Sundays of the last five weeks, and never more than about 150 MB. Run one by hand with `select private.take_backup();`
  - What is on file: `select d, count(*) as tables, sum(n) as rows, pg_size_pretty(sum(pg_column_size(data))) as size from private.backups group by d order by d desc;`
  - Is the nightly job running: `select jobname, schedule, active from cron.job;` and `select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;`
- **Bring back a client deleted by mistake.** Find them, then restore them from the latest copy that still has them:
  ```sql
  select b.d, x->>'id' as id, x->>'name' as name from private.backups b, jsonb_array_elements(b.data) x where b.tbl = 'clients' and x->>'name' ilike '%anita%' order by b.d desc;
  select private.restore_client('2026-11-17', '<the id>');
  ```
  Their login works again with the password they had, and their logs, diets and chats come back. Photos and report files are not part of the copy, so those are gone. It refuses to run if the client still exists or if their username has been taken since.
- **Space.** The coach and the assistant see "Space and backup" in the account sheet, and a follow-up appears at 80% full. The limits written into `public.app_usage()` are the free plan's (1 GB of files, 500 MB of database): change them there after an upgrade.
- **Errors.** When the app breaks on someone's device it leaves a note: `select at, role, ver, msg, src, ua from public.app_errors order by at desc limit 50;` Notes older than 30 days are cleared by the nightly run.
- **The coach's own copy.** The coach's account sheet has **Download data**: one file with everything she can read, without photos and without passwords.

## If something goes wrong

- **"Almost ready" screen:** `config.js` still has the placeholder values.
- **"Database error querying schema" or "Database error granting user" at sign-in:** Supabase has changed its login tables. Paste the exact error into Claude. The fix is a small change to `_create_login` in `setup.sql`.
- **The project paused:** free projects pause after about a week with no activity. Open the Supabase dashboard and press Restore. Daily use keeps it awake.
- **Backups:** see "Looking after it" above. A copy of the data is made inside the database every night. That protects against mistakes, not against losing the Supabase project itself: for that, move to the Pro plan (about $25 a month), which keeps daily backups outside the database.

## Notes

- Days follow India time, so a new day starts at midnight IST.
- Logins are stored as `<username>@stayingfit.app` behind the scenes. No email is ever sent, and nobody needs an email address.
- Deleting a client from the app removes their photos and report files first, then their login, logs and chats. Deleting from the SQL Editor (`delete_client`) leaves the files in Storage.
