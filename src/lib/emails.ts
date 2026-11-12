/** Notification emails. Every value is user input, so HTML is escaped. */
export type Email = { subject: string; html: string; text: string }

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

function layout(title: string, lines: string[], cta: { label: string; url: string }) {
  const body = lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px;color:#3a3a3c">${l}</p>`).join("")
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1e">
<p style="font-size:18px;font-weight:700;margin:0 0 16px">eStamp</p>
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>${body}
<p style="margin:20px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#1c1c1e;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">${cta.label}</a></p>
</div>`
}

export function inviteEmail(o: { orgName: string; inviter: string; role: string; appUrl: string; email: string }): Email {
  const who = o.inviter || "An admin"
  return {
    subject: `${o.inviter || "You're"} ${o.inviter ? "invited you" : "invited"} to ${o.orgName} on eStamp`,
    html: layout(
      `Join ${esc(o.orgName)} on eStamp`,
      [
        `${esc(who)} added you as ${o.role === "admin" ? "an admin" : "a member"}, so you can stamp documents with your organisation's stamps.`,
        `Sign in with <strong>${esc(o.email)}</strong> and you'll join automatically.`,
      ],
      { label: "Sign in to eStamp", url: o.appUrl },
    ),
    text: `${who} added you to ${o.orgName} on eStamp. Sign in with ${o.email} at ${o.appUrl} and you'll join automatically.`,
  }
}

export function approvalRequestedEmail(o: { requester: string; stamp: string; file: string; note: string; url: string }): Email {
  const lines = [`${esc(o.requester)} asks to use <strong>${esc(o.stamp)}</strong> on <strong>${esc(o.file)}</strong>.`]
  if (o.note) lines.push(`&ldquo;${esc(o.note)}&rdquo;`)
  return {
    subject: `Approval needed: ${o.stamp} on ${o.file}`,
    html: layout("A stamp needs your approval", lines, { label: "Review the request", url: o.url }),
    text: `${o.requester} asks to use ${o.stamp} on ${o.file}.${o.note ? ` Note: ${o.note}` : ""} Review it at ${o.url}`,
  }
}

export function approvalDecidedEmail(o: { approved: boolean; decider: string; stamp: string; file: string; note: string; url: string }): Email {
  const verdict = o.approved ? "approved" : "rejected"
  const lines = [`${esc(o.decider || "An admin")} ${verdict} your request to use <strong>${esc(o.stamp)}</strong> on <strong>${esc(o.file)}</strong>.`]
  if (o.note) lines.push(`${o.approved ? "Note" : "Reason"}: ${esc(o.note)}`)
  if (o.approved) lines.push("You can stamp that file now. A different or edited file needs a new request.")
  return {
    subject: `${o.approved ? "Approved" : "Rejected"}: ${o.stamp} on ${o.file}`,
    html: layout(o.approved ? "Request approved" : "Request rejected", lines, { label: o.approved ? "Stamp it now" : "See the request", url: o.url }),
    text: `${o.decider || "An admin"} ${verdict} your request to use ${o.stamp} on ${o.file}.${o.note ? ` ${o.note}` : ""} ${o.url}`,
  }
}
