// Finding official pages for any letter, in any country, with Google Search.
//
// - Only the summary, the sender and the step titles are used, never the letter
//   itself, so the search sees no more than the person already approved.
// - Gemini searches with Google Search. Every page it found is checked by the
//   code against the list of official web addresses (officialDomains.js);
//   anything else is dropped, however useful it looks.
// - Google's terms ask apps to show the search suggestions that come with the
//   result, so they are passed on to be shown next to the links.
import { getGenerativeModel, InferenceMode } from 'firebase/ai'
import { ai, EXPLAIN_MODELS } from './firebase'
import { QuotaError, isDailyLimit, markUsedUp, usableModels } from './quota'
import { countryNameEnglish } from './countries'
import { hostOf, isOfficialDomain } from './officialDomains'

function searchModel(modelName) {
  return getGenerativeModel(
    ai,
    {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: modelName,
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2 },
      },
    },
    { timeout: 30000 },
  )
}

function buildPrompt({ sender, summary, steps, country, language }) {
  return `Find official government web pages that help a person act on an official letter they received.

The person lives in ${country ? countryNameEnglish(country) : 'an unknown country'}.
The letter is from: ${sender}
What it is about: ${summary}
What the person needs to do: ${steps.join('; ') || 'not clear'}

Search only for pages on websites of government agencies, public authorities or the EU in the country the letter comes from. Do not use forums, news sites, law firms or private companies. For each useful page, write one short sentence in ${language} on why it helps.`
}

// The domain Google reports for each found page. With the Gemini Developer
// API the link itself is a Google redirect, and the title holds the domain.
function domainOf(chunk) {
  const web = chunk?.web ?? {}
  if (web.domain) return hostOf(web.domain)
  const title = (web.title ?? '').trim()
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title)) return hostOf(title)
  return hostOf(web.uri ?? '')
}

export async function findOfficialPages(input) {
  const models = usableModels(EXPLAIN_MODELS)
  if (models.length === 0) throw new QuotaError()
  let result
  let lastError
  for (const modelName of models) {
    try {
      result = await searchModel(modelName).generateContent(buildPrompt(input))
      break
    } catch (err) {
      lastError = err
      if (isDailyLimit(err)) markUsedUp(modelName)
    }
  }
  if (!result) {
    if (usableModels(EXPLAIN_MODELS).length === 0) throw new QuotaError()
    throw lastError
  }

  const meta = result.response.candidates?.[0]?.groundingMetadata ?? {}
  const chunks = meta.groundingChunks ?? []
  const supports = meta.groundingSupports ?? []

  const pages = []
  let dropped = 0
  chunks.forEach((chunk, index) => {
    const domain = domainOf(chunk)
    if (!chunk?.web?.uri || !isOfficialDomain(domain)) {
      dropped += 1
      return
    }
    if (pages.some((p) => p.domain === domain)) return
    // The sentence Gemini wrote with the help of this page, if any.
    const why = supports.find((s) => s.groundingChunkIndices?.includes(index))?.segment?.text ?? ''
    pages.push({ url: chunk.web.uri, domain, why: why.replace(/^[-*\s]+/, '').trim() })
  })

  return {
    pages: pages.slice(0, 4),
    dropped,
    suggestions: meta.searchEntryPoint?.renderedContent ?? '',
  }
}
