import { MockWhatsAppAdapter } from "@/lib/whatsapp/MockWhatsAppAdapter";
import { WhatsAppCloudApiAdapter } from "@/lib/whatsapp/WhatsAppCloudApiAdapter";
import type { WhatsAppProvider } from "@/lib/whatsapp/WhatsAppProvider";
import type { WhatsAppProviderKind } from "@/lib/whatsapp/types";

export class WhatsAppService {
  private provider: WhatsAppProvider;

  constructor(providerKind: WhatsAppProviderKind = "MOCK") {
    this.provider =
      providerKind === "CLOUD_API"
        ? new WhatsAppCloudApiAdapter()
        : new MockWhatsAppAdapter();
  }

  connect(businessId: string) {
    return this.provider.connect(businessId);
  }

  getStatus(businessId: string) {
    return this.provider.getStatus(businessId);
  }

  sendMessage(conversationId: string, message: string) {
    return this.provider.sendMessage(conversationId, message);
  }

  disconnect(businessId: string) {
    return this.provider.disconnect(businessId);
  }

  onMessage(callback: Parameters<WhatsAppProvider["onMessage"]>[0]) {
    return this.provider.onMessage(callback);
  }

  onStatusChange(callback: Parameters<WhatsAppProvider["onStatusChange"]>[0]) {
    return this.provider.onStatusChange(callback);
  }
}

export function createWhatsAppService() {
  const configured = process.env.WHATSAPP_PROVIDER === "CLOUD_API" ? "CLOUD_API" : "MOCK";
  return new WhatsAppService(configured);
}
