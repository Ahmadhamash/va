import type {
  ChannelConnection,
  ChannelProvider,
  Conversation,
  ConversationStatus,
  KnowledgeItem,
  Message,
  MessageSender,
  Product
} from "@/lib/types";

export type BackendItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: string | number | null;
  currency: string;
  available: boolean;
  created_at: string;
  updated_at: string;
};

export type BackendPolicy = {
  id: string;
  policy_type: string;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

export type BackendChannel = {
  id: string;
  platform: string;
  public_id: string;
  is_active: boolean;
  configured_keys: string[];
  endpoints: Record<string, string>;
  created_at: string;
};

export type BackendChatSession = {
  id: string;
  title: string | null;
  channel: string;
  external_user_id: string | null;
  created_at: string;
};

export type BackendMessage = {
  id: string;
  session_id: string;
  role: string;
  content: string | null;
  media_type: string | null;
  media_url: string | null;
  created_at: string;
};

export const providerToPlatform: Record<ChannelProvider, string> = {
  WHATSAPP: "whatsapp",
  FACEBOOK: "messenger",
  INSTAGRAM: "instagram"
};

const platformToProvider: Record<string, ChannelProvider> = {
  whatsapp: "WHATSAPP",
  messenger: "FACEBOOK",
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM"
};

const channelLabels: Record<ChannelProvider, { name: string; description: string; metric: string }> = {
  WHATSAPP: {
    name: "WhatsApp Business",
    description: "Official WhatsApp customer conversations through the backend channel adapter.",
    metric: "Backend channel"
  },
  FACEBOOK: {
    name: "Facebook Messenger",
    description: "Messenger webhooks and replies managed by the FastAPI backend.",
    metric: "Backend channel"
  },
  INSTAGRAM: {
    name: "Instagram DM",
    description: "Instagram messaging connection stored in backend integrations.",
    metric: "Backend channel"
  }
};

export function itemToProduct(item: BackendItem): Product {
  const price = item.price === null || item.price === undefined ? "Not set" : `${item.price} ${item.currency || ""}`.trim();
  return {
    id: item.id,
    name: item.name,
    price,
    available: item.available,
    description: item.description || item.category || "No description saved yet."
  };
}

export function policyToKnowledge(policy: BackendPolicy): KnowledgeItem {
  const type = policy.policy_type?.toLowerCase().includes("faq")
    ? "FAQ"
    : policy.policy_type?.toLowerCase().includes("file")
      ? "File"
      : "Policy";

  return {
    id: policy.id,
    type,
    title: policy.title,
    content: policy.content
  };
}

function channelHandle(channel: BackendChannel) {
  return channel.endpoints.callback_url || channel.endpoints.inbound_url || channel.endpoints.script_url || channel.public_id;
}

export function channelsToCards(channels: BackendChannel[]): ChannelConnection[] {
  const byProvider = new Map<ChannelProvider, BackendChannel>();
  for (const channel of channels) {
    const provider = platformToProvider[channel.platform.toLowerCase()];
    if (provider) byProvider.set(provider, channel);
  }

  return (["WHATSAPP", "FACEBOOK", "INSTAGRAM"] as ChannelProvider[]).map((provider) => {
    const backendChannel = byProvider.get(provider);
    const label = channelLabels[provider];
    return {
      id: backendChannel?.id || `setup_${provider.toLowerCase()}`,
      provider,
      name: label.name,
      handle: backendChannel ? channelHandle(backendChannel) : "Not connected",
      status: backendChannel ? (backendChannel.is_active ? "CONNECTED" : "SETUP_REQUIRED") : "SETUP_REQUIRED",
      description: label.description,
      metric: backendChannel ? `${backendChannel.configured_keys.length} configured keys` : label.metric
    };
  });
}

function sessionChannel(channel: string): ChannelProvider {
  return platformToProvider[channel?.toLowerCase()] || "WHATSAPP";
}

function messageSender(role: string): MessageSender {
  const normalized = role.toLowerCase();
  if (normalized === "assistant" || normalized === "ai") return "AI";
  if (normalized === "system") return "SYSTEM";
  if (normalized === "human" || normalized === "agent") return "HUMAN";
  return "CUSTOMER";
}

export function messageFromBackend(message: BackendMessage): Message {
  return {
    id: message.id,
    conversationId: message.session_id,
    sender: messageSender(message.role),
    body: message.content || (message.media_type ? `[${message.media_type}]` : ""),
    createdAt: message.created_at
  };
}

export function sessionToConversation(session: BackendChatSession, messages: BackendMessage[] = []): Conversation {
  const mappedMessages = messages.map(messageFromBackend);
  const last = mappedMessages[mappedMessages.length - 1];
  const title = session.title || session.external_user_id || "Customer conversation";
  const status: ConversationStatus = "AI_HANDLING";

  return {
    id: session.id,
    customerName: title,
    customerPhone: session.external_user_id || session.channel || "Backend chat",
    channel: sessionChannel(session.channel),
    status,
    lastMessage: last?.body || title,
    lastMessageAt: last?.createdAt || session.created_at,
    messages: mappedMessages
  };
}
