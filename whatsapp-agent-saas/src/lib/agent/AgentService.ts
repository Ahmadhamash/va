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
  "إلغاء",
  "الغاء",
  "شكوى",
  "موظف",
  "انسان",
  "زعلان",
  "مشكلة"
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
        reply: "أكيد، رح أحولك لموظف يساعدك بأسرع وقت."
      };
    }

    if (lower.includes("منتج") || lower.includes("خدمات") || lower.includes("بتبيعوا") || lower.includes("product") || lower.includes("sell")) {
      const names = mockProducts.slice(0, 3).map((product) => product.name).join("، ");
      return {
        status: "AI_HANDLING",
        reply: `عنا ${names}. احكيلي بأي خدمة مهتم عشان أفصّل لك أكثر.`
      };
    }

    if (lower.includes("وقت") || lower.includes("دوام") || lower.includes("open") || lower.includes("hours")) {
      return {
        status: "AI_HANDLING",
        reply: `أوقات العمل: ${mockBusiness.openingHours}.`
      };
    }

    if (lower.includes("واتساب") || lower.includes("فيسبوك") || lower.includes("انست") || lower.includes("instagram") || lower.includes("facebook")) {
      return {
        status: "AI_HANDLING",
        reply: "نعم، مسار يدعم واتساب بزنس وفيسبوك ماسنجر وإنستغرام DM من لوحة واحدة، والربط الحقيقي يتم عبر إعدادات Meta الرسمية."
      };
    }

    const knowledgeHint = mockKnowledge[0]?.content || mockBusiness.description;
    const contextSize = history.length ? ` عندي ${history.length} رسائل سابقة في هذه المحادثة.` : "";
    return {
      status: "AI_HANDLING",
      reply: `${knowledgeHint}${contextSize} كيف بقدر أساعدك اليوم؟`
    };
  }
}
