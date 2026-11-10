// Stayingfit settings. Fill in the two Supabase values from
// Supabase → Project Settings → API Keys (see README, step 4).
// The publishable (anon) key is safe to put on the web: the database rules
// decide what each login can see. NEVER put the secret / service_role key here.
window.STAYINGFIT_CONFIG = {
  supabaseUrl: 'https://lxwhanyqdjjpndifvffz.supabase.co',
  supabaseAnonKey: 'sb_publishable_gEUOmg6iMDQmj6NB9MfpsQ_YJzmcUU3',

  coachName: 'Pushpanjali',               // shown to clients ("Chat with Pushpanjali")
  coachFullName: 'Pushpanjali Khaitan',   // shown on the sign-in screen
  appUrl: '',                             // the link put in login messages; leave blank to use this site's address
  loginDomain: 'stayingfit.app'           // must match login_email() in supabase/setup.sql; don't change
};
