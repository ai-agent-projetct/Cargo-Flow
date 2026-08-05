const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `CargoFlo <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendQuotationEmail = async (quotation, customer, recipientEmail) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a56db; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CargoFlo</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2>Quotation ${quotation.quoteNumber}</h2>
        <p>Dear ${customer.contactName || customer.companyName},</p>
        <p>Please find your freight quotation details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Quote Number</td>
            <td style="padding: 10px;">${quotation.quoteNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Mode</td>
            <td style="padding: 10px; text-transform: capitalize;">${quotation.mode}</td>
          </tr>
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Origin</td>
            <td style="padding: 10px;">${quotation.originCity || ''}, ${quotation.originCountry || ''}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Destination</td>
            <td style="padding: 10px;">${quotation.destinationCity || ''}, ${quotation.destinationCountry || ''}</td>
          </tr>
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Total Amount</td>
            <td style="padding: 10px; font-size: 18px; font-weight: bold; color: #1a56db;">${quotation.currency} ${parseFloat(quotation.totalAmount).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Valid Until</td>
            <td style="padding: 10px;">${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}</td>
          </tr>
        </table>
        ${quotation.notes ? `<p><strong>Notes:</strong> ${quotation.notes}</p>` : ''}
        <div style="margin-top: 30px; padding: 20px; background: #dbeafe; border-radius: 8px;">
          <p style="margin: 0; color: #1e40af;">To accept this quotation or for any queries, please contact us.</p>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>CargoFlo - Cargo ERP System</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `Freight Quotation ${quotation.quoteNumber} from CargoFlo`,
    html,
    text: `Quotation ${quotation.quoteNumber} - Total: ${quotation.currency} ${quotation.totalAmount}`,
  });
};

const sendInvoiceEmail = async (invoice, customer, recipientEmail) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a56db; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CargoFlo</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2>Invoice ${invoice.invoiceNumber}</h2>
        <p>Dear ${customer.contactName || customer.companyName},</p>
        <p>Please find your invoice details below:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Invoice Number</td>
            <td style="padding: 10px;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Issue Date</td>
            <td style="padding: 10px;">${new Date(invoice.issueDate).toLocaleDateString()}</td>
          </tr>
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Due Date</td>
            <td style="padding: 10px;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Total Amount</td>
            <td style="padding: 10px; font-size: 18px; font-weight: bold; color: #dc2626;">${invoice.currency} ${parseFloat(invoice.totalAmount).toFixed(2)}</td>
          </tr>
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Balance Due</td>
            <td style="padding: 10px;">${invoice.currency} ${parseFloat(invoice.balanceAmount).toFixed(2)}</td>
          </tr>
        </table>
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
      </div>
      <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>CargoFlo - Cargo ERP System</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `Invoice ${invoice.invoiceNumber} from CargoFlo`,
    html,
    text: `Invoice ${invoice.invoiceNumber} - Total: ${invoice.currency} ${invoice.totalAmount} - Due: ${invoice.dueDate}`,
  });
};

const sendShipmentUpdateEmail = async (shipment, recipientEmail, updateMessage) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a56db; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CargoFlo</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2>Shipment Update - ${shipment.shipmentNumber}</h2>
        <p>${updateMessage}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Shipment</td>
            <td style="padding: 10px;">${shipment.shipmentNumber}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Current Status</td>
            <td style="padding: 10px; text-transform: capitalize;">${shipment.status.replace(/_/g, ' ')}</td>
          </tr>
          <tr style="background: #e5e7eb;">
            <td style="padding: 10px; font-weight: bold;">Current Location</td>
            <td style="padding: 10px;">${shipment.currentLocation || 'N/A'}</td>
          </tr>
        </table>
      </div>
      <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>CargoFlo - Cargo ERP System</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `Shipment Update - ${shipment.shipmentNumber}`,
    html,
    text: `Shipment ${shipment.shipmentNumber} - Status: ${shipment.status}`,
  });
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a56db; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CargoFlo</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2>Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #1a56db; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset Password</a>
        </div>
        <p>This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Password Reset - CargoFlo',
    html,
    text: `Reset your password: ${resetUrl}`,
  });
};

const sendWelcomeEmail = async (user) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a56db; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">CargoFlo</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2>Welcome to CargoFlo!</h2>
        <p>Hi ${user.name},</p>
        <p>Your account has been created successfully. You can now log in with your email address.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/login" style="background: #1a56db; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Log In Now</a>
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Welcome to CargoFlo',
    html,
    text: `Welcome to CargoFlo, ${user.name}! Log in at ${process.env.CLIENT_URL}/login`,
  });
};

module.exports = {
  sendEmail,
  sendQuotationEmail,
  sendInvoiceEmail,
  sendShipmentUpdateEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
