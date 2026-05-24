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

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  customerName: string;
  customerPhone: string;
  status: ConversationStatus;
  lastMessage: string;
  lastMessageAt: string;
  messages: Message[];
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
  type: "Business Info" | "FAQ" | "Policy" | "File";
  title: string;
  content: string;
};
