import type { ConnectionStatus } from "@/lib/types";

export type WhatsAppProviderKind = "CLOUD_API" | "MOCK";

export type WhatsAppConnectionSnapshot = {
  businessId: string;
  provider: WhatsAppProviderKind;
  status: ConnectionStatus;
  phoneNumber?: string;
  displayName?: string;
  businessAccountId?: string;
  phoneNumberId?: string;
  lastConnectedAt?: string;
  error?: string;
};

export type IncomingWhatsAppMessage = {
  conversationId: string;
  customerName: string;
  customerPhone: string;
  body: string;
  receivedAt: string;
};

export type WhatsAppMessageResult = {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
};

export type MessageHandler = (message: IncomingWhatsAppMessage) => void | Promise<void>;
export type StatusHandler = (status: WhatsAppConnectionSnapshot) => void | Promise<void>;
