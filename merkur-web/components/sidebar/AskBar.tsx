'use client'

import { useState } from 'react'

export default function AskBar() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setLoading(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (res.ok) {
        const data = (await res.json()) as { answer: string }
        setAnswer(data.answer)
      } else {
        setAnswer('Something went wrong. Please try again.')
      }
    } catch {
      setAnswer('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-2 pb-2">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-1">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your notes…"
          className="flex-1 min-w-0 bg-stone-50 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300 placeholder:text-stone-400 dark:placeholder:text-stone-600 outline-none px-2 py-1 rounded border border-stone-200 dark:border-stone-700 focus:border-amber-400 dark:focus:border-amber-600 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 text-xs px-2 py-1 text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-40"
          title="Ask AI"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </form>

      {answer && (
        <div className="mt-2 text-xs text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700 p-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">Answer</span>
            <button
              onClick={() => setAnswer(null)}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 leading-none"
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
