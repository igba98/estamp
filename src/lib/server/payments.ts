import "server-only"

/*
 * The one place a mobile-money provider plugs in (ClickPesa, AzamPay, Selcom…).
 * Add an implementation to PROVIDERS and set PAYMENT_PROVIDER=<name>.
 * Until then checkout answers 503 and the Billing panel says payments aren't open.
 */
export type StartPayment = {
  /** Our payment id: send it as the provider's reference so the webhook can find it. */
  paymentId: string
  amountTzs: number
  /** 255XXXXXXXXX */
  phone: string
  description: string
}

export type WebhookResult = {
  paymentId: string
  providerRef: string | null
  amountTzs: number
  status: "paid" | "failed"
}

export interface PaymentProvider {
  name: string
  /** Start a USSD push / checkout. Returns the provider's own reference. */
  startPayment(p: StartPayment): Promise<{ providerRef: string | null }>
  /** Verify the webhook's signature and read it. Throw if it isn't authentic. */
  parseWebhook(req: Request): Promise<WebhookResult>
}

const PROVIDERS: Record<string, PaymentProvider> = {}

export function paymentProvider(): PaymentProvider | null {
  const name = process.env.PAYMENT_PROVIDER
  return (name && PROVIDERS[name]) || null
}
