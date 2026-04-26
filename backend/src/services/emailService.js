const nodemailer = require('nodemailer');

let cachedTransporter;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!process.env.EMAIL_HOST && !process.env.EMAIL_USER) return null;

  if (process.env.EMAIL_HOST) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: process.env.EMAIL_USER ? {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      } : undefined
    });
  } else {
    cachedTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return cachedTransporter;
}

async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter || !to) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email:noop] ${subject} -> ${to || 'missing recipient'}`);
    }
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Sunny Furniture <noreply@sunnyfurniture.local>',
    to,
    subject,
    text,
    html
  });
}

async function sendOrderConfirmation(order) {
  const email = order.guestContact?.email;
  await sendMail({
    to: email,
    subject: `Sunny Furniture order ${order.orderNumber}`,
    text: `Thank you for your order ${order.orderNumber}. Current status: ${order.fulfillmentStatus}.`,
    html: `<p>Thank you for shopping with Sunny Furniture.</p><p><strong>Order:</strong> ${order.orderNumber}</p><p>Status: ${order.fulfillmentStatus}</p>`
  });
}

async function sendOrderStatus(order) {
  const email = order.guestContact?.email;
  await sendMail({
    to: email,
    subject: `Your Sunny Furniture order is ${order.fulfillmentStatus}`,
    text: `Order ${order.orderNumber} is now ${order.fulfillmentStatus}.`,
    html: `<p>Order <strong>${order.orderNumber}</strong> is now <strong>${order.fulfillmentStatus}</strong>.</p>`
  });
}

module.exports = { sendMail, sendOrderConfirmation, sendOrderStatus };
