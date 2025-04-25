import dotenv from "dotenv";
dotenv.config({ path: "./config/config.env" });

import { sendEmail } from "./utils/emailConfig.js"; // Adjust path if needed

(async () => {
  try {
    await sendEmail({
      email: "p.pothebungkarn@gmail.com",
      subject: "🔔 Test Reminder",
      message: "This is a test reminder email.",
      html: "<p>This is a <b>test</b> reminder email.</p>",
    });

    console.log("✅ Test email sent");
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
})();
