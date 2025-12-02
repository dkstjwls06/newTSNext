import nodemailer from "nodemailer";
import { ENV } from "../config/env";

const hasSmtpConfig =
  !!ENV.SMTP_HOST && !!ENV.SMTP_USER && !!ENV.SMTP_PASS;

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    })
  : null;

/**
 * 실제 이메일 발송 함수
 * - SMTP 설정이 없으면 기존 sendEmailStub 처럼 콘솔에만 찍고 끝낸다.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const { to, subject, text, html } = params;

  if (!transporter) {
    console.warn(
      "[mailer] SMTP 설정이 없어서 실제 메일은 보내지 않고 콘솔에만 출력합니다.",
    );
    console.log("=== EMAIL STUB (from mailer) ===");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Text:", text);
    console.log("HTML:", html);
    console.log("================================");
    return;
  }

  await transporter.sendMail({
    from: ENV.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}