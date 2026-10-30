LearnMate — complete project (v3, 2026-10-29)
================================================

This zip is the ENTIRE current LearnMate source, every file matching
every other file. It was typechecked together (tsc, 0 errors) before
packing. Replace as a set — do not mix these files with older copies.

WHAT TO DO
----------
1. Back up first: copy your whole project folder
     C:\Users\pc\OneDrive\Desktop\~passion~\STD 09\IT\learnmate
   to a new folder called  learnmate-backup . If anything goes wrong,
   you can copy it back.

2. In VS Code, close the page.tsx and MilestonePath.tsx tabs if they
   are open (choose "Don't Save" if asked). An open tab can hold on
   to the old file and overwrite the new one when you save.

3. Extract this zip anywhere (e.g. Downloads).

4. Copy EVERYTHING from inside the extracted folder INTO your
   learnmate folder (the one above), and choose "Replace" when
   Windows asks. Copy INTO the folder — do NOT delete your learnmate
   folder first. Your .env.local is not in this zip and stays
   untouched, along with anything else only you have.

5. Restart the app: in PowerShell,
     cd "C:\Users\pc\OneDrive\Desktop\~passion~\STD 09\IT\learnmate"
     npm run dev
   If the app still behaves like the old version afterwards, stop
   the server, delete the .next folder inside learnmate, and run
   npm run dev again.

CHECKS (both must find lines)
-----------------------------
  Select-String -Path "C:\Users\pc\OneDrive\Desktop\~passion~\STD 09\IT\learnmate\app\dashboard\page.tsx" -Pattern "lm-msdd"
  Select-String -Path "C:\Users\pc\OneDrive\Desktop\~passion~\STD 09\IT\learnmate\components\learnmate\MilestonePath.tsx" -Pattern "Rewatch this video"

SQL
---
No SQL is needed for this update. One conditional item: the sql
folder holds notifications-migration.sql — if the welcome
notification has never appeared in your bell tab, run that file once
in the Supabase SQL Editor (it is safe to run again). The
video-progress fixes you already ran are included in
video-progress-migration.sql for completeness; you do not need to
run it again.

WHAT'S INSIDE
-------------
- The full dashboard with everything built so far: tests with the
  30-minute start window, missed-test handling and the open-window
  typewriter prompt; the Doubt Clearer history fix; the bell
  notifications; a video for every chapter with watch progress;
  the counting-up progress ring and Continue Learning; milestones
  with watched highlighting, the right slide-in panel and the new
  course dropdown; and the collapsible sidebar.
- All API routes (tests, quizzes, schedules, notifications,
  video-progress, chapters, push), all components, lib, and the
  public assets (logos, images, service worker).
