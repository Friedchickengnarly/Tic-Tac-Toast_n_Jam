# TicTacToast

A static browser game built with HTML, CSS, and JavaScript.

## Publish On GitHub Pages

1. Create a new GitHub repository.
2. Upload every file and folder from this project, including `.github`, `assets`, `index.html`, `styles.css`, and `app.js`.
3. In the GitHub repo, open **Settings** > **Pages**.
4. Set **Source** to **GitHub Actions**.
5. Push or upload to the `main` branch.
6. Open the published Pages URL after the `Publish TicTacToast` workflow finishes.

## Local Preview

Open `index.html` directly in a browser, or run:

```bash
npm run start
```

The project has no build step. GitHub Pages publishes the files as-is.

## Enable Remote Play

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. Add a Web app inside that Firebase project.
3. Create a Realtime Database.
4. Copy the Firebase web app config into `firebase-config.js`.
5. For early testing only, use public Realtime Database rules:

```json
{
  "rules": {
    "tictactoastRooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Those rules make the game rooms public. Use them only while testing, then add Firebase Authentication and tighter rules before sharing widely.

After publishing, open the live game, choose **Remote friend**, click **Create Remote Game**, then send the copied invite link to your friend.
