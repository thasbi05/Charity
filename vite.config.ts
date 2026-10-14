import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'email-otp-api-handler',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/send-otp-email' && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              req.on('end', async () => {
                try {
                  const { email, otp, from } = JSON.parse(body || '{}');
                  const resendKey = process.env.RESEND_API_KEY;
                  let sent = false;
                  let provider = 'Simulated Delivery (In-App)';
                  const senderEmail = from || process.env.EMAIL_FROM || 'Udyavar Muslim Unity UAE <onboarding@resend.dev>';

                  if (resendKey && email) {
                    try {
                      const emailRes = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${resendKey}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          from: senderEmail,
                          to: [email],
                          subject: `Your Verification Passcode: ${otp} - Udyavar Muslim Unity UAE`,
                          html: `
                            <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                              <h2 style="color: #065f46; margin-top: 0;">Udyavar Muslim Unity UAE</h2>
                              <p style="color: #334155; font-size: 14px;">Here is your 6-digit one-time verification passcode to authenticate into the Udyavar Muslim Unity UAE management system:</p>
                              <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
                                <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #047857;">${otp}</span>
                              </div>
                              <p style="color: #64748b; font-size: 12px;">This passcode is valid for 10 minutes. Sent via ${senderEmail}. If you did not request this login, please ignore this email.</p>
                            </div>
                          `,
                        }),
                      });
                      if (emailRes.ok) {
                        sent = true;
                        provider = 'Resend SMTP API';
                      }
                    } catch (e) {
                      console.warn('Resend email error:', e);
                    }
                  }

                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      success: true,
                      sent,
                      provider,
                      email,
                      otp,
                      message: sent
                        ? `OTP successfully delivered to real inbox: ${email}`
                        : `OTP code generated for ${email}. (Displayed below for instant verification)`,
                    })
                  );
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }
            next();
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: './',
          name: 'Udyavar Muslim Unity UAE - Charity Management & Accounting',
          short_name: 'UMU UAE',
          description: 'Official management and accounting system for Udyavar Muslim Unity UAE with member records, contributions, electronic receipts, relief vouchers, chart of accounts, and financial reports.',
          theme_color: '#0f172a',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            {
              src: './pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: './pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: './pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
