const config = require("../config/config");
const logger = require("../utils/logger");

/**
 * Thin wrapper around Resend's REST API (https://resend.com) via plain
 * fetch — no SDK dependency needed. Optional: without RESEND_API_KEY set,
 * every send() call just logs and reports failure; callers must treat that
 * as "couldn't send," never as a hard error (same "never fabricate
 * confidence" pattern as gemini.service.js).
 */

function isEnabled() {
  return Boolean(config.email.resendApiKey);
}

async function send({ to, subject, html }) {
  if (!isEnabled()) {
    logger.warn("mailer", `RESEND_API_KEY not set — would have emailed ${to}: "${subject}"`);
    return { ok: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: config.email.fromAddress, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn("mailer", `Resend API error ${res.status}: ${body}`);
      return { ok: false, reason: "send_failed" };
    }
    return { ok: true };
  } catch (err) {
    logger.warn("mailer", `Resend request failed: ${err.message}`);
    return { ok: false, reason: "network_error" };
  }
}

function sendInviteEmail(to, inviteLink, inviterName, role) {
  const from = inviterName || "Someone";
  return send({
    to,
    subject: `${from} invited you to join AI QA Engineer`,
    html: `
      <p>${from} invited you to join their AI QA Engineer workspace as <b>${role}</b>.</p>
      <p><a href="${inviteLink}">Accept the invite</a></p>
      <p style="color:#888">This link expires in 7 days.</p>
    `,
  });
}

function sendTeamAddedNotification(to, name, role) {
  return send({
    to,
    subject: "You've been added to a team on AI QA Engineer",
    html: `
      <p>Hi ${name || ""},</p>
      <p>You've been added to a workspace as <b>${role}</b>. Sign in to get started.</p>
    `,
  });
}

module.exports = { isEnabled, send, sendInviteEmail, sendTeamAddedNotification };
