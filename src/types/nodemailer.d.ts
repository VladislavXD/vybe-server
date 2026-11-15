declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    [key: string]: unknown;
  }

  export interface SentMessageInfo {
    messageId?: string;
    envelope?: unknown;
    accepted?: string[];
    rejected?: string[];
    pending?: string[];
    response?: string;
  }

  export interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>;
    verify?(): Promise<boolean>;
  }

  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    [key: string]: unknown;
  }

  export function createTransport(options?: TransportOptions): Transporter;

  const nodemailer: {
    createTransport(options?: TransportOptions): Transporter;
  };

  export default nodemailer;
}
