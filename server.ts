import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

let resendClient: Resend | null = null;

function getResend() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/send-receipt", async (req, res) => {
    const { email, studentName, amount, receiptNumber, purpose, date } = req.body;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "RESEND_API_KEY not configured" });
    }

    try {
      const resend = getResend();
      const { data, error } = await resend.emails.send({
        from: 'School Org <onboarding@resend.dev>',
        to: [email],
        subject: `Official Receipt - ${receiptNumber}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px;">
            <h1 style="color: #1a202c; font-size: 24px; margin-bottom: 8px;">Official Receipt</h1>
            <p style="color: #718096; font-size: 14px; margin-bottom: 32px;">No. ${receiptNumber}</p>
            
            <div style="background-color: #f7fafc; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase; font-weight: bold;">Received From</p>
              <p style="margin: 4px 0 0; color: #1a202c; font-size: 18px; font-weight: bold;">${studentName}</p>
            </div>

            <div style="margin-bottom: 32px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #edf2f7; padding: 12px 0;">
                <span style="color: #718096;">Purpose</span>
                <span style="color: #1a202c; font-weight: bold;">${purpose}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #edf2f7; padding: 12px 0;">
                <span style="color: #718096;">Date</span>
                <span style="color: #1a202c; font-weight: bold;">${date}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 24px 0;">
                <span style="color: #1a202c; font-size: 18px; font-weight: bold;">Total Amount</span>
                <span style="color: #1a202c; font-size: 24px; font-weight: bold;">PHP ${amount.toFixed(2)}</span>
              </div>
            </div>

            <p style="color: #718096; font-size: 12px; text-align: center; margin-top: 40px;">
              Thank you for your contribution to the organization.
            </p>
          </div>
        `
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.status(200).json({ data });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
