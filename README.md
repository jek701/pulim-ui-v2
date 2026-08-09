# React + TypeScript + Vite

## Phone authentication (Eskiz SMS)

The primary registration and sign-in flow is phone + one-time code. The code is
sent by **pulim-api-v2** through the [Eskiz](https://eskiz.uz) SMS gateway — the
frontend never talks to Eskiz and there is **no reCAPTCHA** anywhere in the flow.

Flow:

1. `POST /auth/phone/send-code` — the API issues a 6-digit code, stores only its
   HMAC in Firestore (`phoneVerifications`), and sends the SMS via Eskiz.
2. `POST /auth/phone/verify` — on a match the API mints a Firebase **custom
   token**, which the client exchanges via `signInWithCustomToken`.

Firebase Auth stays the session and uid store (`/v1/*` still verifies ID tokens),
so existing phone users keep their uid and data — they are matched by number
through the Admin SDK. Rate limiting (resend cooldown, sends per hour, wrong-code
attempts) lives in the API, which is what replaced reCAPTCHA.

Setup:

1. Fill `ESKIZ_EMAIL` / `ESKIZ_PASSWORD` (and `ESKIZ_FROM` once you have an
   approved nickname) in the API environment — see `pulim-api-v2/.env.example`.
2. Get the SMS text approved in the Eskiz cabinet; the templates live in
   `pulim-api-v2/src/services/phoneAuth.service.ts` (`MESSAGE_TEMPLATES`).
3. The Firebase **Phone** provider is no longer used and can be disabled; keep
   Email/Password enabled for legacy users. The app does not expose email
   registration.
4. Only `+998` numbers are accepted — Eskiz's `/message/sms/send` is domestic.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
