import type { Conversation, KnowledgeItem, Product } from "@/lib/types";

export const mockBusiness = {
  id: "biz_demo",
  name: "Amman Bistro",
  type: "Restaurant",
  language: "Both",
  tone: "Jordanian Arabic",
  description:
    "A warm restaurant serving shawarma, burgers, salads, and family meals for delivery and pickup.",
  openingHours: "Saturday to Thursday, 11 AM - 12 AM",
  location: "Amman, Jordan",
  deliveryAreas: "Sweifieh, Khalda, Abdoun, Jabal Amman",
  pricingNotes: "Delivery starts from 2 JOD.",
  refundPolicy: "Refunds and cancellations should be transferred to human support."
};

export const mockConnection = {
  provider: "MOCK" as const,
  status: "DEMO_MODE" as const,
  phoneNumber: "+962 79 000 0000",
  displayName: "Amman Bistro Demo",
  lastConnectedAt: new Date().toISOString()
};

export const mockProducts: Product[] = [
  {
    id: "prod_1",
    name: "Chicken Shawarma Meal",
    price: "3.50 JOD",
    available: true,
    description: "Served with fries, garlic sauce, and pickles."
  },
  {
    id: "prod_2",
    name: "Family Grill Box",
    price: "18 JOD",
    available: true,
    description: "Mixed grill box for four people."
  },
  {
    id: "prod_3",
    name: "Classic Burger",
    price: "4.25 JOD",
    available: true,
    description: "Beef patty, cheese, house sauce, and fries."
  }
];

export const mockKnowledge: KnowledgeItem[] = [
  {
    id: "kn_1",
    type: "Business Info",
    title: "Opening hours",
    content: "Saturday to Thursday from 11 AM to 12 AM."
  },
  {
    id: "kn_2",
    type: "FAQ",
    title: "Delivery areas",
    content: "Delivery is available in Sweifieh, Khalda, Abdoun, and Jabal Amman."
  },
  {
    id: "kn_3",
    type: "Policy",
    title: "Refunds",
    content: "Refunds and cancellations should be transferred to a human support agent."
  }
];

export const mockConversations: Conversation[] = [
  {
    id: "conv_1",
    customerName: "Sara",
    customerPhone: "+962 79 123 4567",
    status: "AI_HANDLING",
    lastMessage: "Do you deliver to Khalda?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    messages: [
      {
        id: "msg_1",
        conversationId: "conv_1",
        sender: "CUSTOMER",
        body: "Hi, do you deliver to Khalda?",
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      },
      {
        id: "msg_2",
        conversationId: "conv_1",
        sender: "AI",
        body: "Yes, we deliver to Khalda. Delivery starts from 2 JOD. What would you like to order?",
        createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
      }
    ]
  },
  {
    id: "conv_2",
    customerName: "Omar",
    customerPhone: "+962 78 222 1111",
    status: "NEEDS_HUMAN",
    lastMessage: "I want to cancel my order.",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    messages: [
      {
        id: "msg_3",
        conversationId: "conv_2",
        sender: "CUSTOMER",
        body: "I want to cancel my order.",
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
      },
      {
        id: "msg_4",
        conversationId: "conv_2",
        sender: "SYSTEM",
        body: "Refund or cancellation request detected. Human handoff recommended.",
        createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString()
      }
    ]
  },
  {
    id: "conv_3",
    customerName: "Lina",
    customerPhone: "+962 77 888 9911",
    status: "HUMAN_ACTIVE",
    lastMessage: "Can someone help me with a missing item?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    messages: [
      {
        id: "msg_5",
        conversationId: "conv_3",
        sender: "CUSTOMER",
        body: "Can someone help me with a missing item?",
        createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
      },
      {
        id: "msg_6",
        conversationId: "conv_3",
        sender: "HUMAN",
        body: "Of course, I am checking your order now.",
        createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString()
      }
    ]
  }
];

export const analyticsData = {
  conversationsToday: 128,
  aiResolved: 93,
  handoffs: 11,
  avgResponseTime: "4.8s",
  peakHours: [
    { hour: "10 AM", conversations: 12 },
    { hour: "12 PM", conversations: 26 },
    { hour: "2 PM", conversations: 18 },
    { hour: "6 PM", conversations: 34 },
    { hour: "9 PM", conversations: 28 }
  ],
  mostAsked: [
    "Delivery areas",
    "Opening hours",
    "Family meal price",
    "Refund request"
  ]
};
