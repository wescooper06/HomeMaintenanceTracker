# Home Maintenance Tracker

A starter two-frontend web application using Google Sheets as the backend database.

## Project structure

```
/home-maintenance-app
│
├── /lib
│   ├── auth.js
│   ├── sheets.js
│   └── utils.js
│
├── /mobile
│   ├── index.html
│   ├── mobile.css
│   └── mobile.js
│
├── /dashboard
│   ├── index.html
│   ├── dashboard.css
│   └── dashboard.js
│
└── README.md
```

## Overview

- Backend: Google Sheets API v4
- Spreadsheet name: **Home Maintenance Tracker**
- Tab name: **Tasks**
- Authentication: **Google OAuth Popup**
- Hosting: **GitHub Pages**
- Two frontends:
  - Mobile App: `/mobile`
  - Desktop Dashboard: `/dashboard`

## Spreadsheet setup

1. Create a Google Sheet named **Home Maintenance Tracker**.
2. Add a tab named **Tasks**.
3. Add these header columns in row 1 exactly:
   - Property
   - Interior/Exterior
   - Upstairs/Downstairs
   - Area
   - Category
   - Task Description
   - Priority
   - Order
   - Cost ($)
   - State
   - Date Completed

4. Keep the task rows starting from row 2.

## Google Cloud setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Google Sheets API**.
4. Go to **APIs & Services > Credentials**.
5. Create an **OAuth 2.0 Client ID** for a Web application.
6. Add authorized redirect URIs for your GitHub Pages deployment and local testing.
   - Example GitHub Pages paths:
     - `https://<USERNAME>.github.io/<REPO>/mobile/`
     - `https://<USERNAME>.github.io/<REPO>/dashboard/`
   - Example local testing paths:
     - `http://127.0.0.1:5500/mobile/`
     - `http://127.0.0.1:5500/dashboard/`
7. Copy the OAuth Client ID.

## Spreadsheet ID

1. Open your Google Sheet.
2. Copy the ID from the URL between `/d/` and `/edit`.
   - Example: `https://docs.google.com/spreadsheets/d/###SPREADSHEET_ID###/edit`
3. Use that ID in your app configuration.

## Configuration

The apps read configuration from the browser global values in each `index.html` file:

- `window.GOOGLE_OAUTH_CLIENT_ID`
- `window.GOOGLE_SPREADSHEET_ID`

Replace the placeholder values in both `/mobile/index.html` and `/dashboard/index.html`.

### Example configuration snippet

```html
<script>
  window.GOOGLE_OAUTH_CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID';
  window.GOOGLE_SPREADSHEET_ID = 'YOUR_GOOGLE_SHEETS_SPREADSHEET_ID';
</script>
```

## GitHub Pages deployment

1. Commit this repository to GitHub.
2. Go to the repository settings.
3. Enable **GitHub Pages** on the `main` branch and select the root directory.
4. Publish.

## Using GitHub Pages secrets

GitHub Pages itself does not provide direct runtime secrets for client-side JavaScript. The recommended approach is to use a build or deployment step that injects secrets into a static `config.js` file before publishing.

### Example workflow

- Store `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_SPREADSHEET_ID` as GitHub repository secrets.
- Use GitHub Actions to generate a tiny config file from those secrets.
- Replace the placeholder script block in the static pages with one that loads the generated config.

The starter code already includes placeholder values so you can replace them manually if you prefer.

## Local testing

You can test using a simple static server. For example:

```powershell
cd "c:\Users\wcoop\OneDrive\Documents - Wes\personal documents\Issaquah Home Repairs - List of Tasks\Home Maintenance Tracker"
python -m http.server 5500
```

Then open:
- `http://127.0.0.1:5500/mobile/index.html`
- `http://127.0.0.1:5500/dashboard/index.html`

## How the shared code works

- `/lib/auth.js` handles Google OAuth popup authentication and token storage.
- `/lib/sheets.js` exposes:
  - `getTasks()`
  - `addTask()`
  - `updateTask(rowIndex, values)`
  - `deleteTask(rowIndex)`
- `/lib/utils.js` parses sheet rows, formats dates, and formats currency.

## Notes

- New tasks default to **Pending**.
- If a task is marked **Complete**, the app automatically sets `Date Completed`.
- The mobile frontend supports grouping tasks by property, search, filters, add/edit, and delete.
- The desktop dashboard supports full table view, inline editing, bulk edits, sorting, filtering, and charts.

## Next steps

- Replace the placeholder configuration values.
- Add the `Tasks` sheet header row.
- Test one sheet row and verify the mobile and dashboard views.
- Add GitHub Actions if you want secret injection on deploy.
