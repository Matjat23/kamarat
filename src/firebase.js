// Firebase setup for Kamarat: the app, App Check and the two AI models.
import { initializeApp } from 'firebase/app'
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  CustomProvider,
} from 'firebase/app-check'
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from 'firebase/ai'

// These values identify the Firebase project. They are not secrets.
const firebaseConfig = {
  apiKey: 'AIzaSyD6WLGBgbknqqpdHxi10y03ZTRE_uyjaT4',
  authDomain: 'kamarat-hackathon.firebaseapp.com',
  projectId: 'kamarat-hackathon',
  storageBucket: 'kamarat-hackathon.firebasestorage.app',
  messagingSenderId: '950303220911',
  appId: '1:950303220911:web:7b05623b3b863a5a54205a',
}

export const app = initializeApp(firebaseConfig)

// App Check proves that AI requests come from this app.
// In development there is no reCAPTCHA key, so the SDK uses a debug token.
// The token is printed in the browser console the first time and has to be
// added in the Firebase console (App Check > Apps > Manage debug tokens).
// A fixed token can be put in .env.local, which is never committed.
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY

if (!recaptchaKey) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true
}

const appCheckProvider = recaptchaKey
  ? new ReCaptchaV3Provider(recaptchaKey)
  : new CustomProvider({
      getToken: () => Promise.reject(new Error('No App Check provider set up')),
    })

initializeAppCheck(app, {
  provider: appCheckProvider,
  isTokenAutoRefreshEnabled: true,
})

const ai = getAI(app, { backend: new GoogleAIBackend() })

const englishText = [{ type: 'text', languages: ['en'] }]

// Private model: runs only on this device (Gemini Nano in Chrome).
// If Nano is missing it throws an error instead of falling back to the cloud,
// so text with personal data can never leave the device by accident.
export const privateModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE,
  onDeviceParams: {
    createOptions: {
      expectedInputs: englishText,
      expectedOutputs: englishText,
    },
  },
})

// Detector model: also only on this device. It reads the pasted notice and
// returns a JSON list of personal details. The schema forces Nano to answer
// with that list only, so it cannot rewrite the letter.
const DETAIL_TYPES = ['NAME', 'ID', 'ADDRESS', 'CASE', 'PHONE', 'EMAIL']

export const detectorModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_ON_DEVICE,
  onDeviceParams: {
    createOptions: {
      expectedInputs: englishText,
      expectedOutputs: englishText,
    },
    promptOptions: {
      responseConstraint: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            type: { type: 'string', enum: DETAIL_TYPES },
          },
          required: ['text', 'type'],
        },
      },
    },
  },
})

// Cloud model: only ever gets text the user has approved.
export const cloudModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_IN_CLOUD,
})

// Explainer model: cloud Gemini that must answer in a fixed JSON shape,
// so the code can check every quote and work out deadlines itself.
export function getExplainModel(responseJsonSchema, systemInstruction) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: 'gemini-3.5-flash-lite',
      systemInstruction,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema,
      },
    },
  })
}

// Asks Chrome whether Gemini Nano is ready, without starting a download.
// Returns 'available', 'downloadable', 'downloading', 'unavailable'
// or 'unsupported' when the browser has no Prompt API at all.
export async function checkOnDeviceModel() {
  if (!('LanguageModel' in self)) return 'unsupported'
  try {
    return await self.LanguageModel.availability({
      expectedInputs: englishText,
      expectedOutputs: englishText,
    })
  } catch {
    return 'unavailable'
  }
}
