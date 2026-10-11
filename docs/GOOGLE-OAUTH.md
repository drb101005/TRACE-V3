# Google sign-in setup

TRACE uses Google's web-server authorization-code flow. The browser opens a popup to the FastAPI backend; Google returns to the backend callback, and the backend verifies the account before issuing a TRACE session. No Google password is collected by TRACE.

## Google Cloud Console values for local development

Create an OAuth client with these values:

- **Application type:** Web application
- **Name:** TRACE Local Development (the name is only for your console)
- **Authorized JavaScript origins:**
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
- **Authorized redirect URIs:**
  - `http://127.0.0.1:8000/api/v1/auth/google/callback`
- **Use this client for an AI-powered agent:** Leave unchecked; this is a user sign-in client for the TRACE web app.

Google's redirect URI must exactly match the backend callback configured in TRACE. For production, use HTTPS and replace the development origins and callback with your deployed frontend and API domains. Google's web-server OAuth docs allow localhost redirect URIs for development and require the configured redirect URI to match exactly: [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server).

Configure the consent screen/Google Auth Platform branding with the TRACE app name and support email. For an External app left in Testing, add the Gmail accounts that will sign in as test users. TRACE requests only `openid`, `email`, and `profile`; it does not access Gmail messages or Google Drive.

## Add the client credentials locally

Copy the OAuth client ID and secret from Google Cloud Console into the ignored `.env` file (do not commit or send the secret):

```dotenv
TRACE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
TRACE_GOOGLE_CLIENT_SECRET=your-client-secret
TRACE_GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/v1/auth/google/callback
VITE_API_ORIGIN=http://127.0.0.1:8000
```

`TRACE_GOOGLE_CLIENT_ID` and `TRACE_GOOGLE_CLIENT_SECRET` are read only by FastAPI. `VITE_API_ORIGIN` is the backend origin used to open the OAuth popup. It is not a secret. Restart both FastAPI and Vite after changing `.env`.

Google is the only TRACE sign-in method. The designated administrator `drb.genai@gmail.com` is created automatically on first successful Google sign-in. The administrator adds client and auditor Gmail addresses in the Users page; those addresses can then use **Continue with Google** with that exact verified email. Role and engagement permissions come from TRACE's database. There is no password login or self-registration.
