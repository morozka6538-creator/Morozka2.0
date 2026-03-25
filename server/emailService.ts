import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'user',
    pass: process.env.SMTP_PASS || 'pass',
  },
});

export const sendWelcomeEmail = async (email: string, username: string) => {
  const mailOptions = {
    from: `"Morozka 2.0" <${process.env.SMTP_FROM || 'no-reply@morozka.im'}>`,
    to: email,
    subject: 'Добро пожаловать в Morozka 2.0! ❄️',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; background-color: #050a10; margin: 0; padding: 0; color: #ffffff; }
          .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, rgba(23, 31, 42, 0.8), rgba(9, 14, 21, 0.8)); border: 1px solid rgba(0, 210, 255, 0.2); border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; background: linear-gradient(to right, #00d2ff, #3a7bd5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .content { line-height: 1.6; font-size: 16px; color: #cbd5e1; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #64748b; }
          .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo">Morozka 2.0</span>
          </div>
          <div class="content">
            <h2 style="color: #ffffff;">Привет, ${username}! ❄️</h2>
            <p>Добро пожаловать в самый легкий и морозный мессенджер!</p>
            <p>Ваш аккаунт успешно создан. Теперь вы можете обмениваться сообщениями, совершать аудио и видеозвонки в реальном времени.</p>
            <a href="http://localhost:5173" class="button">Начать общение</a>
          </div>
          <div class="footer">
            &copy; 2026 Morozka 2.0 Messenger. Все права защищены.<br>
            Это автоматическое уведомление, отвечать на него не нужно.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};
