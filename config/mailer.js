import nodemailer from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } from './env.js';

// Create a reusable transporter
const transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(SMTP_PORT) || 587,
    secure: false, // true for 465, false for 587 (STARTTLS)
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

/**
 * Send a password reset code email
 * @param {string} toEmail - The recipient's email address
 * @param {string} resetCode - The 6-digit reset code
 * @param {string} firstName - The user's first name for personalization
 */
export const sendResetCodeEmail = async (toEmail, resetCode, firstName) => {
    const mailOptions = {
        from: `"Gbenro Global Synergy" <${SMTP_USER}>`,
        to: toEmail,
        subject: 'Password Reset Code',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
                <h2 style="color: #1a1a2e; margin-top: 0;">Password Reset Request</h2>
                <p style="color: #4a4a68; font-size: 15px; line-height: 1.6;">
                    Hi ${firstName},
                </p>
                <p style="color: #4a4a68; font-size: 15px; line-height: 1.6;">
                    We received a request to reset your password. Use the code below to complete the process:
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; background: #f0f4ff; padding: 16px 32px; border-radius: 8px; border: 2px dashed #4f6ef7;">
                        ${resetCode}
                    </span>
                </div>
                <p style="color: #4a4a68; font-size: 14px; line-height: 1.6;">
                    This code expires in <strong>15 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                    Gbenro Global Synergy Ltd &mdash; Poultry Farm Inventory System
                </p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

export default transporter;
