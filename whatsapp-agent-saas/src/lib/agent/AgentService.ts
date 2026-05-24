import { mockBusiness, mockKnowledge, mockProducts } from "@/lib/mock-data";
import type { Conversation, ConversationStatus } from "@/lib/types";

const handoffWords = [
  "refund",
  "cancel",
  "angry",
  "complaint",
  "bad service",
  "human",
  "agent",
  "استرجاع",
  "الغاء",
  "شكوى",
  "موظف",
  "انسان"
];

export type AgentResult = {
  reply: string;
  status: ConversationStatus;
  handoffReason?: string;
};

export class AgentService {
  async test(message: string): Promise<AgentResult> {
    return this.generateReply(message, []);
  }

  async replyToConversation(message: string, history: Conversation["messages"]): Promise<AgentResult> {
    return this.generateReply(message, history);
  }

  private async generateReply(message: string, history: Conversation["messages"]): Promise<AgentResult> {
    const lower = message.toLowerCase();
    const handoffMatch = handoffWords.find((word) => lower.includes(word.toLowerCase()));

    if (handoffMatch) {
      return {
        status: "NEEDS_HUMAN",
        handoffReason: `Matched handoff keyword: ${handoffMatch}`,
        reply: "I can help connect you with a team member who can handle this carefully."
      };
    }

    if (lower.includes("deliver") || lower.includes("delivery")) {
      return {
        status: "AI_HANDLING",
        reply: `Yes, ${mockBusiness.name} delivers to ${mockBusiness.deliveryAreas}. Delivery starts from ${mockBusiness.pricingNotes}`
      };
    }

    if (lower.includes("product") || lower.includes("menu") || lower.includes("sell")) {
      const names = mockProducts.slice(0, 3).map((product) => product.name).join(", ");
      return {
        status: "AI_HANDLING",
        reply: `We currently offer ${names}. Which one are you interested in so I can share the right details?`
      };
    }

    if (lower.includes("open") || lower.includes("hours")) {
      return {
        status: "AI_HANDLING",
        reply: `We are open ${mockBusiness.openingHours}.`
      };
    }

    const knowledgeHint = mockKnowledge[0]?.content || mockBusiness.description;
    const contextSize = history.length ? ` I can see ${history.length} earlier messages in this conversation.` : "";
    return {
      status: "AI_HANDLING",
      reply: `Thanks for reaching out. ${knowledgeHint}${contextSize} How can I help you today?`
    };
  }
}
