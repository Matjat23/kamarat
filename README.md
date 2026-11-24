# Kamarat

Kamarat helps you understand an official notice, like a letter from a migration agency, a tax office or a university, without giving away who you are.

I have lived in Senegal, France, Sweden and the US, and every move came with letters I did not fully understand. Kamarat is the friend I wanted: one who knows the system, never guesses, and never asks for my personal number just to explain a paragraph.

## How it works

1. You paste a notice.
2. Gemini Nano runs on your own device and lists your personal details (names, ID numbers, addresses, case numbers, phones, emails). My code checks that each one really is in the text, adds pattern checks, and replaces them with labels like `[NAME_1]`. Dates and amounts stay as they are.
3. You see your notice next to what would be shared, hide anything else, and approve.
4. Only the approved text goes to cloud Gemini, which explains what the notice asks of you: what you must do, what you can do and what is unclear. Every point quotes the sentence it comes from, and my code checks that the quote is really in the notice.
5. Deadlines are calculated by the code, not the AI. If a deadline counts from the day you received the letter, Kamarat asks you for that date.

If the on-device model is not available, nothing is sent anywhere. Kamarat falls back to the pattern check and lets you hide details yourself.

Kamarat is not legal advice and does not make you anonymous. It shows you exactly what leaves your device and where every answer comes from.

## Built with

- React and Vite
- Firebase AI Logic with hybrid inference: `ONLY_ON_DEVICE` (Gemini Nano in Chrome) for anything personal, `ONLY_IN_CLOUD` for the approved text
- Firebase App Check
- Firebase Hosting

## Running it locally

You need desktop Chrome with the built-in Prompt API (Gemini Nano). In `chrome://flags`, enable "Prompt API" and restart Chrome.

```
npm install
npm run dev
```

App Check needs a debug token in development. Create `.env.local` with:

```
VITE_APPCHECK_DEBUG_TOKEN=your-debug-token
```

and register the same token in the Firebase console under App Check, Apps, Manage debug tokens.

## License

Apache 2.0
