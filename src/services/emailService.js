const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Create email transporter based on environment configuration
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('SMTP configuration incomplete. Email service will not be available.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
}

/**
 * Send Google Maps link via email
 * @param {string} toEmail - Recipient email address
 * @param {string} mapsUrl - Google Maps URL to send
 * @param {object} routeInfo - Optional route information for the email body
 */
async function sendMapsLinkEmail(toEmail, mapsUrl, routeInfo = {}) {
  const transporter = createTransporter();

  if (!transporter) {
    throw new Error('Email service is not configured. Please set SMTP environment variables.');
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    throw new Error('Invalid email address provided.');
  }

  if (!mapsUrl) {
    throw new Error('Maps URL is required.');
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  const { routeId, state, startPoint, endPoint } = routeInfo;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .route-info { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #667eea; }
    .btn { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚛 Trucking Console</h1>
      <p>Your Google Maps Route Link</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Here is your Google Maps route link as requested:</p>
      
      ${routeId ? `
      <div class="route-info">
        <strong>Route Details:</strong><br>
        <p>Route ID: ${routeId}</p>
        ${state ? `<p>State: ${state}</p>` : ''}
        ${startPoint ? `<p>🚩 Start: ${startPoint}</p>` : ''}
        ${endPoint ? `<p>🏁 End: ${endPoint}</p>` : ''}
      </div>
      ` : ''}
      
      <p><a href="${mapsUrl}" class="btn">🗺️ Open in Google Maps</a></p>
      
      <p>Or copy this link:</p>
      <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
        ${mapsUrl}
      </p>
      
      <div class="footer">
        <p>This email was sent from Trucking Console - Permit Converter</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  // Build plain text email with consistent formatting
  const routeDetails = [
    routeId ? `Route ID: ${routeId}` : null,
    state ? `State: ${state}` : null,
    startPoint ? `Start: ${startPoint}` : null,
    endPoint ? `End: ${endPoint}` : null
  ].filter(Boolean).join('\n');

  const emailText = `Trucking Console - Your Google Maps Route Link

${routeDetails ? routeDetails + '\n' : ''}
Google Maps Link:
${mapsUrl}

Click or copy the link above to open your route in Google Maps.

---
This email was sent from Trucking Console - Permit Converter
`;

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: `🚛 Your Trucking Route - Google Maps Link${routeId ? ` (${routeId})` : ''}`,
    text: emailText,
    html: emailHtml
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${toEmail}. Message ID: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    logger.error(`Failed to send email to ${toEmail}: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

module.exports = {
  sendMapsLinkEmail
};
