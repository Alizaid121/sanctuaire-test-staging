# Sanctuaire Test: environments and release checklist

## The two environments
| | Live | Staging |
|---|---|---|
| Purpose | what you and your partner really use | where every change is tested first |
| GitHub repo | `sanctuaire-test` | `sanctuaire-test-staging` |
| Address | alizaid121.github.io/sanctuaire-test/ | alizaid121.github.io/sanctuaire-test-staging/ |
| Database | Supabase project in the first account | Supabase project `sanctuaire-test-staging` in the second account |
| Look | green bar, normal icon | brass bar, "STAGING" in the title, icon with a STAGING band |
| PINs | your real PINs | different PINs, so a mix-up is noticed at once |

Both sites run the same code. Only three things differ and are NEVER copied between the repos:
1. `config.js` (database address and key, environment name)
2. `manifest.webmanifest` (app name and colour)
3. the `icons/` folder

Safety nets in the code: `env.js` stops with a red screen if `config.js` does not match the site's address, keeps staging and live browser storage apart, and blocks any request to a database that is not the configured one.

## The rule
Develop and test in STAGING. Release to LIVE only when the whole update is complete and tested.
Never test destructive steps (reset, core update, delete) on live first.

## Release checklist
1. **Staging is green.** The update is uploaded to the staging repo, its SQL has run on the staging database, and both phones have passed the phone checklist below.
2. **Write down the update.** The list of changed files and the SQL files, in order (the package gives you this).
3. **Database first, additive only.** Run the new SQL on the LIVE database (first account). Never delete anything at this step, so the old site keeps working while you upload.
4. **Upload to the live repo.** Upload only the changed files. Do NOT upload `config.js`, `manifest.webmanifest` or `icons/` from the staging package.
5. **Check live on both phones** with the same checklist.
6. **Tag the release.** GitHub: Releases, Draft a new release, new tag such as `v2.2.0`. This is your way back.
7. **Core update?** (new translator model, provider or tool) Run `select hub_core_update('<test id>', '<label>');` on the LIVE database at this point, together with that test's own clearing step in the update package.

## Update notice ceremony (needs the notice system live in the repo you are updating)
Ask the assistant for **"notice build"** after the update passed on staging. It gives you the START notice (or the page that makes it), the DONE notice, the new `version.js` and an ordered list for that update. The order is always:
1. Upload the START notice (`update-notice.json`, state `updating`). **Wait until it is live** (open `.../update-notice.json?x=1` until it says `updating`) and check that an open app shows the pop-up.
2. Run the update's SQL (additive only).
3. Upload all update files **in one commit** (including the new `version.js`). Wait for the green tick.
4. Check the updated app yourself with `?skipnotice=1` after the address.
5. Upload the DONE notice (state `done`). Open apps change to "complete" and Continue refreshes them.
The first time the engine itself is released to a repo, open apps do not have it yet, so release it when nobody is using the app. Full spec: the project document "Update notice system".

## Rollback
Open the previous tag on GitHub, download its ZIP, upload the old versions of the changed files to the live repo. Because database changes are additive, the old files keep working with the new database.

## Phone checklist (both phones, staging first, then live)
- Install screen appears in the browser, the app installs, the installed app opens.
- Sign in with the PIN. Home shows welcome, the three test cards and their progress.
- Tests tab, Guides tab and Profile tab open. The EN/FR button changes the language everywhere.
- Open Test 1, Test 2 and the phone check. Each opens straight away without asking for a PIN.
- Admin: Profile shows the reports area and a PDF downloads.
- Sign out returns to the login, and a test link opened afterwards goes back to the login.
- On staging: the bar is brass and says STAGING; the other site's data is not visible.

## Installing the two apps (live and staging)
They are two separate apps. Each one has its own identity in Chrome (the `id` in its `manifest.webmanifest`): live uses the origin root (`"./"` means `/`), staging uses `/sanctuaire-test-staging/`. Never give two manifests the same `id`: Chrome then treats them as ONE app, an install does nothing, and an installed app changes into the other one.
- Install live from the live address, staging from the staging address. Staging has the brass bar, the STAGING icon band and the name "Test STAGING".
- If an app ever shows the wrong name or icon, uninstall both apps (on a PC: `chrome://apps`, right-click, Remove; on a phone: long-press the icon, Uninstall), then install each again from its own address.
- On a PC, open `chrome://web-app-internals` to see each installed app's manifest id.
- Before uploading a `config.js`, read its first line: it says LIVE or STAGING. A LIVE file in the staging repo (or the reverse) makes the site stop with the red "Wrong environment" screen. That screen is the safety net working.

## Known extras in the live repo
`sheet.html` at the repository root (a duplicate), `sanctuaire-test1/finder.html` and `sanctuaire-test1/index.html` (old pages, not linked). They are not part of the staging copy. You can delete them from live when convenient.
