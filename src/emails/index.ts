import { createElement, type ReactElement } from "react"
import { render } from "@react-email/render"
import StampedDocument, * as stamped from "./stamped-document"
import ContactReceived, * as contact from "./contact-received"
import NewInboundNotification, * as inbound from "./new-inbound-notification"
import Receipt, * as receipt from "./receipt"
import ProductUpdate, * as update from "./product-update"

/** HTML + plain-text versions of one email (every send includes both). */
export async function renderEmail(el: ReactElement) {
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })])
  return { html, text }
}

type Entry<P> = { Component: (p: P) => ReactElement; meta: (p: P) => { subject: string; preheader: string }; preview: P; variants: Record<string, P> }
const entry = <P,>(Component: ((p: P) => ReactElement) & { PreviewProps: P }, mod: { meta: Entry<P>["meta"]; variants: Record<string, P> }): Entry<P> => ({
  Component,
  meta: mod.meta,
  preview: Component.PreviewProps,
  variants: mod.variants,
})

/** Every template with its realistic and worst-case props (tests, scripts/send-test-emails.ts). */
export const templates = {
  "stamped-document": entry(StampedDocument, stamped),
  "contact-received": entry(ContactReceived, contact),
  "new-inbound-notification": entry(NewInboundNotification, inbound),
  receipt: entry(Receipt, receipt),
  "product-update": entry(ProductUpdate, update),
}

/** All (template, variant, props) cases, "preview" first. */
export function allCases() {
  return Object.entries(templates).flatMap(([name, t]) =>
    Object.entries({ preview: t.preview, ...t.variants }).map(([variant, props]) => {
      const T = t as Entry<typeof props>
      return { name, variant, props, meta: T.meta(props), element: createElement(T.Component, props) }
    }),
  )
}
