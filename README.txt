SATHISH FAMILY FINANCE — UPDATED FILES
=======================================

This ZIP is based on the four files you uploaded. It keeps the Firebase project configuration for:
- Project ID: sathish-family-finance
- Auth domain: sathish-family-finance.firebaseapp.com

FILES
-----
index.html       App page
style.css        Responsive desktop/mobile styling
app.js           Firebase Auth + Firestore CRUD and clearer permission-error diagnostics
firestore.rules  User-private Firestore access rules
README.txt       Setup / troubleshooting

IMPORTANT
---------
1. Keep this app in its own Firebase project. Do not replace NAINIKA BAKES files or rules.
2. The code cannot publish itself. You must deploy the files to Hosting and publish Firestore Rules in Firebase Console.
3. If you see "Missing or insufficient permissions", that is normally a Firestore Rules/authentication issue, not a Hosting publish issue.
4. Your rules must be published in the same project used by app.js (sathish-family-finance).
5. Make sure you are signed in with the same account used by this app. Rules permit a user to access only:
   users/{their-auth-uid}/...
6. Do not solve this by using `allow read, write: if true;`.

CHECKLIST
---------
A. Firebase Console > Authentication > Sign-in method > Email/Password enabled.
B. Firebase Console > Firestore Database > database created.
C. Firestore > Rules: paste firestore.rules from this ZIP and click Publish.
D. Confirm app.js firebaseConfig projectId is exactly `sathish-family-finance`.
E. Reload the app, sign out, sign in again.
F. If the error remains, open browser DevTools > Console and send the exact error code/message (hide personal details).

Rules included
--------------
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId}/{document=**} {

      allow read, write:
        if request.auth != null
        && request.auth.uid == userId;

    }

  }
}

Hosting note
------------
Deploy index.html, style.css, app.js and firestore.rules as appropriate. For Firebase Hosting, only the public website files need to be hosted; firestore.rules must be published separately through Firestore Rules (or deployed using Firebase CLI).
