import type { WhatsAppProvider } from "@/lib/whatsapp/WhatsAppProvider";
import type {
  MessageHandler,
  StatusHandler,
  WhatsAppConnectionSnapshot,
  WhatsAppMessageResult
} from "@/lib/whatsapp/types";

export class WhatsAppCloudApiAdapter implements WhatsAppProvider {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();

  async connect(businessId: string): Promise<WhatsAppConnectionSnapshot> {
    const snapshot: WhatsAppConnectionSnapshot = {
      businessId,
      provider: "CLOUD_API",
      status: "SETUP_REQUIRED",
      error: "Official WhatsApp Business Cloud API setup is ready for Meta credentials."
    };
    await this.emitStatus(snapshot);
    return snapshot;
  }

  async getStatus(businessId: string): Promise<WhatsAppConnectionSnapshot> {
    return {
      businessId,
      provider: "CLOUD_API",
      status: "SETUP_REQUIRED",
      error: "Add Meta app credentials and phone number id to activate production messaging."
    };
  }

  async sendMessage(conversationId: string, message: string): Promise<WhatsAppMessageResult> {
    if (!process.env.WHATSAPP_CLOUD_API_TOKEN) {
      return {
        ok: false,
        error: "Missing official WhatsApp Business Cloud API token."
      };
    }

    return {
      ok: true,
      providerMessageId: `cloud_placeholder_${conversationId}_${message.length}`
    };
  }

  async disconnect(businessId: string): Promise<WhatsAppConnectionSnapshot> {
    const snapshot: WhatsAppConnectionSnapshot = {
      businessId,
      provider: "CLOUD_API",
      status: "DISCONNECTED"
    };
    await this.emitStatus(snapshot);
    return snapshot;
  }

  onMessage(callback: MessageHandler) {
    this.messageHandlers.add(callback);
    return () => this.messageHandlers.delete(callback);
  }

  onStatusChange(callback: StatusHandler) {
    this.statusHandlers.add(callback);
    return () => this.statusHandlers.delete(callback);
  }

  private async emitStatus(snapshot: WhatsAppConnectionSnapshot) {
    for (const handler of this.statusHandlers) {
      await handler(snapshot);
    }
  }
}
