import nodemailer from "nodemailer";

// Create reusable transporter
const createTransporter = () => {
  // For production, use your actual SMTP settings
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // For development/testing, you can use this:
  // return nodemailer.createTransport({
  //   host: 'smtp.ethereal.email',
  //   port: 587,
  //   secure: false,
  //   auth: {
  //     user: 'your-ethereal-email',
  //     pass: 'your-ethereal-password',
  //   },
  // });
};

// Send email function
export const sendEmail = async (options) => {
  const transporter = createTransporter();

  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  console.log(`Email sent: ${info.messageId}`);

  return info;
};

export default sendEmail;
