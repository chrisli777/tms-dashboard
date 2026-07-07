import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { cookies } from "next/headers"
import { logisticsTools } from "@/lib/chat/logistics-tools"
import { buildSystemPrompt } from "@/lib/chat/system-prompt"
import { SESSION_COOKIE, getRoleForToken } from "@/lib/auth"

// The AI SDK must run on the Node.js runtime, never the edge runtime.
export const runtime = "nodejs"
export const maxDuration = 60

// Use Claude directly via the project's own ANTHROPIC_API_KEY (not the Vercel
// AI Gateway, whose free tier blocks these models).
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Claude-backed logistics assistant. Streams a response and can call the
 * read-only logistics query tools to look up live database data. Available to
 * any signed-in user (including the read-only visitor) since it never mutates.
 */
export async function POST(req: Request) {
  // Require a valid session (defense in depth on top of middleware).
  const cookieStore = await cookies()
  const role = await getRoleForToken(cookieStore.get(SESSION_COOKIE)?.value)
  if (!role) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: buildSystemPrompt(),
    messages: await convertToModelMessages(messages),
    tools: logisticsTools,
    // Allow several tool round-trips so Claude can query, then answer.
    stopWhen: stepCountIs(8),
  })

  return result.toUIMessageStreamResponse()
}
