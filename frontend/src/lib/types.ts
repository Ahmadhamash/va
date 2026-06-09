export type ConnectionStatus =
  | "DISCONNECTED"
  | "SETUP_REQUIRED"
  | "PENDING_VERIFICATION"
  | "CONNECTED"
  | "READY"
  | "ERROR"
  | "DEMO_MODE";

export type ConversationStatus = "AI_HANDLING" | "NEEDS_HUMAN" | "HUMAN_ACTIVE" | "CLOSED";
export type MessageSender = "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
export type ChannelProvider = "WHATSAPP" | "FACEBOOK" | "INSTAGRAM" | "MESSENGER" | "WEBHOOK" | "WIDGET";

export type ChannelConnection = {
  id: string;
  provider: ChannelProvider;
  name: string;
  handle: string;
  status: ConnectionStatus;
  description: string;
  metric: string;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
  mediaType?: "text" | "image" | "audio" | "file" | string | null;
  mediaUrl?: string | null;
  deliveryStatus?: "pending" | "sent" | "delivered" | "read" | "failed" | string | null;
};

export type Conversation = {
  id: string;
  customerName: string;
  customerPhone: string;
  channel: ChannelProvider;
  status: ConversationStatus;
  lastMessage: string;
  lastMessageAt: string;
  messages: Message[];
  aiSuggestedReply?: string | null;
  unreadCount?: number;
  deliveryStatus?: string | null;
  context?: {
    connectedAccount?: {
      platform?: string;
      public_id?: string | null;
      page_id?: string | null;
      page_name?: string | null;
    };
    business?: {
      id?: string;
      name?: string | null;
      type?: string | null;
      aiAutoReplyEnabled?: boolean;
    };
    customer?: {
      externalUserId?: string | null;
      displayName?: string | null;
      tags?: string[];
    };
    productCatalog?: {
      product_count?: number;
      categories?: string[];
    };
    knowledgeBase?: {
      item_count?: number;
      categories?: string[];
    };
    previousInteractions?: {
      message_count?: number;
      last_viewed_at?: string | null;
    };
  };
};

export type Product = {
  id: string;
  name: string;
  price: string;
  available: boolean;
  description: string;
};

export type KnowledgeItem = {
  id: string;
  type?: "Business Info" | "FAQ" | "Policy" | "File";
  title: string;
  content?: string;
  category?: string;
  body?: string;
};
