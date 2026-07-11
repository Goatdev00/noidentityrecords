import { supabase } from './supabase'

export type ContactMessage = {
  name: string
  email: string
  subject?: string
  message: string
  website?: string // honeypot — must stay empty
}

/** Sends a contact message to the label's inbox via the send-contact function. */
export async function sendContactMessage(msg: ContactMessage): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-contact', { body: msg })
  if (error) {
    let message = 'No se pudo enviar el mensaje. Intenta de nuevo.'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const body = await ctx.json()
        if (body?.error) message = body.error
      }
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
}
