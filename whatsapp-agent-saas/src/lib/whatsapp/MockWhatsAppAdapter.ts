import type { WhatsAppProvider } from "@/lib/whatsapp/WhatsAppProvider";
import type {
  MessageHandler,
  StatusHandler,
  WhatsAppConnectionSnapshot,
  WhatsAppMessageResult
} from "@/lib/whatsapp/types";

export class MockWhatsAppAdapter implements WhatsAppProvider {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private statusByBusiness = new Map<string, WhatsAppConnectionSnapshot>();

  async connect(businessId: string): Promise<WhatsAppConnectionSnapshot> {
    const snapshot: WhatsAppConnectionSnapshot = {
      businessId,
      provider: "MOCK",
      status: "DEMO_MODE",
      phoneNumber: "+962 79 000 0000",
      displayName: "Demo WhatsApp Business",
      lastConnectedAt: new Date().toISOString()
    };
    this.statusByBusiness.set(businessId, snapshot);
    await this.emitStatus(snapshot);
    return snapshot;
  }

  async getStatus(businessId: string): Promise<WhatsAppConnectionSnapshot> {
    return (
      this.statusByBusiness.get(businessId) ?? {
        businessId,
        provider: "MOCK",
        status: "DEMO_MODE",
        phoneNumber: "+962 79 000 0000",
        displayName: "Demo WhatsApp Business",
        lastConnectedAt: new Date().toISOString()
      }
    );
  }

  async sendMessage(conversationId: string, message: string): Promise<WhatsAppMessageResult> {
    return {
      ok: true,
      providerMessageId: `mock_${conversationId}_${message.length}_${Date.now()}`
    };
  }

  async disconnect(businessId: string): Promise<WhatsAppConnectionSnapshot> {
    const snapshot: WhatsAppConnectionSnapshot = {
      businessId,
      provider: "MOCK",
      status: "DISCONNECTED"
    };
    this.statusByBusiness.set(businessId, snapshot);
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

  async simulateIncomingMessage() {
    for (const handler of this.messageHandlers) {
      await handler({
        conversationId: "conv_mock",
        customerName: "Demo Customer",
        customerPhone: "+962 79 123 4567",
        body: "Do you deliver today?",
        receivedAt: new Date().toISOString()
      });
    }
  }

  private async emitStatus(snapshot: WhatsAppConnectionSnapshot) {
    for (const handler of this.statusHandlers) {
      await handler(snapshot);
    }
  }
}
