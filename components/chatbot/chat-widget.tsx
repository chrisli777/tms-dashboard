"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Bot, MessageCircle, Send, X, Loader2, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "How many containers have arrived?",
  "Show shipments still on the water",
  "Which containers are past their LFD?",
  "List open exceptions",
]

/** Extract concatenated text from a UIMessage's parts. */
function messageText(parts: { type: string; text?: string }[] | undefined): string {
  if (!parts) return ""
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
}

/** True if this assistant message is currently running a database lookup. */
function hasPendingTool(parts: { type: string; state?: string }[] | undefined): boolean {
  if (!parts) return false
  return parts.some(
    (p) =>
      p.type.startsWith("tool-") &&
      (p.state === "input-streaming" || p.state === "input-available"),
  )
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const busy = status === "submitted" || status === "streaming"

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    if (!open) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, open, busy])

  function submit(text: string) {
    const value = text.trim()
    if (!value || busy) return
    sendMessage({ text: value })
    setInput("")
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Respect IME composition (CJK) before submitting on Enter.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      submit(input)
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          aria-label="Open logistics assistant"
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg"
        >
          <MessageCircle className="size-6" />
        </Button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Logistics assistant"
          className="fixed bottom-6 right-6 z-50 flex h-[min(600px,calc(100dvh-3rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
              <Bot className="size-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Logistics Assistant</span>
              <span className="text-xs text-primary-foreground/70">Powered by Claude</span>
            </div>
            <Button
              onClick={() => setOpen(false)}
              size="icon"
              variant="ghost"
              aria-label="Close assistant"
              className="ml-auto size-8 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground text-pretty">
                  Ask me anything about your shipments, containers, tracking status, suppliers,
                  or exceptions. I read live data from the logistics database.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const text = messageText(m.parts as { type: string; text?: string }[])
              const pending = m.role === "assistant" && hasPendingTool(m.parts as { type: string; state?: string }[])
              return (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {pending && (
                      <span className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Database className="size-3.5 animate-pulse" />
                        Querying database…
                      </span>
                    )}
                    {text || (pending ? "" : null)}
                  </div>
                </div>
              )
            })}

            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Something went wrong. Please try again.
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border bg-card p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask about your logistics data…"
                aria-label="Message"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring/50 placeholder:text-muted-foreground focus-visible:ring-2"
              />
              <Button
                onClick={() => submit(input)}
                disabled={busy || !input.trim()}
                size="icon"
                aria-label="Send message"
                className="size-10 shrink-0 rounded-lg"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
