const nodemailer = require("nodemailer");
const config = require("../config/config");
const logger = require("../utils/logger");

/**
 * Three interchangeable send strategies, picked automatically (or forced via
 * EMAIL_PROVIDER):
 *  - Gmail SMTP via nodemailer — no domain to verify, sends to any real
 *    inbox immediately using a personal Gmail account + app password.
 *  - Outlook/Microsoft SMTP via nodemailer (smtp.office365.com) — same idea
 *    for accounts that support self-service app passwords via a Microsoft
 *    account rather than gmail.com.
 *  - Resend's REST API via plain fetch — no SDK dependency, but needs a
 *    verified sending domain to reach arbitrary recipients in production.
 * Without any configured, send() just logs and reports failure; callers
 * must treat that as "couldn't send," never as a hard error (same
 * "never fabricate confidence" pattern as gemini.service.js).
 */

function isGmailConfigured() {
  return Boolean(config.email.gmail.user && config.email.gmail.appPassword);
}

function isOutlookConfigured() {
  return Boolean(config.email.outlook.user && config.email.outlook.appPassword);
}

function isResendConfigured() {
  return Boolean(config.email.resendApiKey);
}

function activeProvider() {
  if (config.email.provider === "gmail") return isGmailConfigured() ? "gmail" : null;
  if (config.email.provider === "outlook") return isOutlookConfigured() ? "outlook" : null;
  if (config.email.provider === "resend") return isResendConfigured() ? "resend" : null;
  // Auto: prefer whichever no-domain SMTP account is configured, else Resend.
  if (isGmailConfigured()) return "gmail";
  if (isOutlookConfigured()) return "outlook";
  if (isResendConfigured()) return "resend";
  return null;
}

function isEnabled() {
  return activeProvider() !== null;
}

let gmailTransporter = null;
function getGmailTransporter() {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.email.gmail.user, pass: config.email.gmail.appPassword },
    });
  }
  return gmailTransporter;
}

async function sendViaGmail({ to, subject, html }) {
  try {
    await getGmailTransporter().sendMail({
      from: `AI QA Engineer <${config.email.gmail.user}>`,
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    logger.warn("mailer", `Gmail SMTP send failed: ${err.message}`);
    return { ok: false, reason: "send_failed" };
  }
}

let outlookTransporter = null;
function getOutlookTransporter() {
  if (!outlookTransporter) {
    outlookTransporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // STARTTLS on 587, not implicit TLS
      auth: { user: config.email.outlook.user, pass: config.email.outlook.appPassword },
    });
  }
  return outlookTransporter;
}

async function sendViaOutlook({ to, subject, html }) {
  try {
    await getOutlookTransporter().sendMail({
      from: `AI QA Engineer <${config.email.outlook.user}>`,
      to,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    logger.warn("mailer", `Outlook SMTP send failed: ${err.message}`);
    return { ok: false, reason: "send_failed" };
  }
}

async function sendViaResend({ to, subject, html }) {
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

const SENDERS = { gmail: sendViaGmail, outlook: sendViaOutlook, resend: sendViaResend };

async function send({ to, subject, html }) {
  const provider = activeProvider();
  if (!provider) {
    logger.warn("mailer", `No email provider configured — would have emailed ${to}: "${subject}"`);
    return { ok: false, reason: "not_configured" };
  }
  return SENDERS[provider]({ to, subject, html });
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
