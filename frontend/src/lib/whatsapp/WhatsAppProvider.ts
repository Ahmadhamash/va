import type {
  MessageHandler,
  StatusHandler,
  WhatsAppConnectionSnapshot,
  WhatsAppMessageResult
} from "@/lib/whatsapp/types";

export interface WhatsAppProvider {
  connect(businessId: string): Promise<WhatsAppConnectionSnapshot>;
  getStatus(businessId: string): Promise<WhatsAppConnectionSnapshot>;
  sendMessage(conversationId: string, message: string): Promise<WhatsAppMessageResult>;
  disconnect(businessId: string): Promise<WhatsAppConnectionSnapshot>;
  onMessage(callback: MessageHandler): () => void;
  onStatusChange(callback: StatusHandler): () => void;
}
