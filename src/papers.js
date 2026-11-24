// "My papers": a private folder that lives only in this browser.
// It keeps the explanation and the approved text (with hidden details as labels),
// never the original letter and never the hidden details themselves.
// Nothing here is sent anywhere.

const KEY = 'kamarat.papers.v1'

export function listPapers() {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

export function savePaper(paper) {
  const list = listPapers().filter((p) => p.id !== paper.id)
  return store([paper, ...list])
}

export function updatePaper(id, patch) {
  const list = listPapers()
  const index = list.findIndex((p) => p.id === id)
  if (index === -1) return false
  list[index] = { ...list[index], ...patch }
  return store(list)
}

export function deletePaper(id) {
  return store(listPapers().filter((p) => p.id !== id))
}

export function deleteAllPapers() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to remove
  }
}

// All open deadlines across every saved paper, soonest first.
export function upcomingDeadlines(papers) {
  const items = []
  for (const paper of papers) {
    paper.actions.forEach((action, index) => {
      if (!action.date || paper.done?.includes(index)) return
      items.push({ paper, action, index, date: new Date(action.date) })
    })
  }
  return items.sort((a, b) => a.date - b.date)
}
