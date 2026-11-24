# Kamarat

Kamarat helps you understand an official notice, like a letter from a migration agency, a tax office or a university, without giving away who you are.

I have lived in Senegal, France, Sweden and the US, and every move came with letters I did not fully understand. Kamarat is the friend I wanted: one who knows the system, never guesses, and never asks for my personal number just to explain a paragraph.

## How it works

1. You paste a notice.
2. Gemini Nano runs on your own device and lists your personal details (names, ID numbers, addresses, case numbers, phones, emails). My code checks that each one really is in the text, adds pattern checks, and replaces them with labels like `[NAME_1]`. Dates and amounts stay as they are.
3. You see your notice next to what would be shared, hide anything else, and approve.
4. Only the approved text goes to cloud Gemini, which explains what the notice asks of you: what you must do, what you can do and what is unclear. Every point quotes the sentence it comes from, and my code checks that the quote is really in the notice.
5. Deadlines are calculated by the code, not the AI. If a deadline counts from the day you received the letter, Kamarat asks you for that date.

You can also ask follow-up questions about the notice. Your question is checked on the device first: names and numbers from the notice get the same labels, and new ones are hidden too, so you see what will be sent. Answers come only from the notice. Each answer either quotes the sentence it is based on (checked by the code) or says that the notice does not answer it and offers to start a question to the sender. It does not answer from general knowledge.

Word help explains a word from the approved text, on the device when Gemini Nano can write your language, otherwise in the cloud, and the screen says which. Listen reads the explanation with a voice that runs on your device. My papers keeps saved explanations in your browser only and works the deadlines out again each time you open them.

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

## Testing the privacy check

The `tools` folder has two small Python scripts:

- `tools/make_test_notices.py` writes made-up notices with known personal details to `public/eval/notices.json`: 30 from templates (Swedish, English and French) plus 6 I wrote by hand in other layouts and languages, including one with no personal details at all.
- `tools/score.py` checks the exact text Kamarat would send. A detail only counts as protected if no part of it is left in that text. It also reports how much of the rest of the letter was kept, so hiding everything would not score well.

Open the app with `?eval` at the end of the address, press "Run the test", download `results.json`, then run `python tools/score.py results.json`. Without Gemini Nano only the pattern check runs: in my test it kept every ID, case, phone and email number out of the shared text (100 of 100) and kept 96 to 100 percent of the other text, but no names or addresses, which is the part Gemini Nano is there for.

## License

Apache 2.0
