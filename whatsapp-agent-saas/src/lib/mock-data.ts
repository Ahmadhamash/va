import type { ChannelConnection, Conversation, KnowledgeItem, Product } from "@/lib/types";

export const mockBusiness = {
  id: "biz_demo",
  name: "مسار",
  type: "منصة خدمة عملاء ذكية",
  language: "العربية",
  tone: "عربي ودود وواضح",
  description: "منصة تساعد أصحاب المطاعم والمتاجر والعيادات على الرد على العملاء من واتساب وفيسبوك وإنستغرام من مكان واحد.",
  openingHours: "طوال أيام الأسبوع من 9 صباحا حتى 11 مساء",
  location: "عمّان، الأردن",
  deliveryAreas: "الأردن ودول الخليج حسب خطة العميل",
  pricingNotes: "تبدأ الباقات من 29 دولار شهريا.",
  refundPolicy: "طلبات الإلغاء والاسترجاع تتحول لفريق بشري مباشرة."
};

export const mockChannels: ChannelConnection[] = [
  {
    id: "channel_whatsapp",
    provider: "WHATSAPP",
    name: "واتساب بزنس",
    handle: "+962 79 000 0000",
    status: "DEMO_MODE",
    description: "قناة المحادثات الأسرع لطلبات العملاء والأسئلة اليومية.",
    metric: "68% من الرسائل"
  },
  {
    id: "channel_facebook",
    provider: "FACEBOOK",
    name: "فيسبوك ماسنجر",
    handle: "Masarjo Page",
    status: "SETUP_REQUIRED",
    description: "استقبل رسائل صفحة فيسبوك وحول التعليقات المهمة لمحادثات.",
    metric: "22% من الرسائل"
  },
  {
    id: "channel_instagram",
    provider: "INSTAGRAM",
    name: "إنستغرام DM",
    handle: "@masarjo",
    status: "PENDING_VERIFICATION",
    description: "تابع رسائل إنستغرام ورد على العملاء بنفس أسلوب البراند.",
    metric: "10% من الرسائل"
  }
];

export const mockConnection = {
  provider: "MOCK" as const,
  status: "DEMO_MODE" as const,
  phoneNumber: "+962 79 000 0000",
  displayName: "مسار ديمو",
  lastConnectedAt: new Date().toISOString()
};

export const mockProducts: Product[] = [
  {
    id: "prod_1",
    name: "وكيل الردود الذكي",
    price: "29$ / شهر",
    available: true,
    description: "يرد على الأسئلة المتكررة ويستخدم معلومات نشاطك فقط."
  },
  {
    id: "prod_2",
    name: "صندوق المحادثات الموحد",
    price: "79$ / شهر",
    available: true,
    description: "كل قنوات واتساب وفيسبوك وإنستغرام في شاشة واحدة."
  },
  {
    id: "prod_3",
    name: "تحويل بشري متقدم",
    price: "ضمن باقة Growth",
    available: true,
    description: "ينقل الشكاوى والإلغاء والغضب لفريقك بدون ما يخرب التجربة."
  }
];

export const mockKnowledge: KnowledgeItem[] = [
  {
    id: "kn_1",
    type: "Business Info",
    title: "القنوات المدعومة",
    content: "واتساب بزنس، فيسبوك ماسنجر، وإنستغرام DM مع طبقة تكامل رسمية عند الربط الحقيقي."
  },
  {
    id: "kn_2",
    type: "FAQ",
    title: "كيف يبدأ العميل؟",
    content: "يدخل للمنصة، يضيف معلومات نشاطه، يختبر الوكيل، ثم يربط القنوات عند جاهزية حسابات Meta."
  },
  {
    id: "kn_3",
    type: "Policy",
    title: "التحويل البشري",
    content: "أي رسالة فيها شكوى، إلغاء، استرجاع، أو غضب تنتقل لفريق بشري مع ملاحظة خاصة."
  }
];

export const mockConversations: Conversation[] = [
  {
    id: "conv_1",
    customerName: "سارة",
    customerPhone: "+962 79 123 4567",
    channel: "WHATSAPP",
    status: "AI_HANDLING",
    lastMessage: "شو الخدمات اللي بتقدموها؟",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    messages: [
      {
        id: "msg_1",
        conversationId: "conv_1",
        sender: "CUSTOMER",
        body: "شو الخدمات اللي بتقدموها؟",
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      },
      {
        id: "msg_2",
        conversationId: "conv_1",
        sender: "AI",
        body: "عنا وكيل ردود ذكي، صندوق محادثات موحد، وتحويل بشري. أي جزء بتحبي أشرح لك عنه أكثر؟",
        createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
      }
    ]
  },
  {
    id: "conv_2",
    customerName: "عمر",
    customerPhone: "Facebook User",
    channel: "FACEBOOK",
    status: "NEEDS_HUMAN",
    lastMessage: "بدي ألغي الاشتراك",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    messages: [
      {
        id: "msg_3",
        conversationId: "conv_2",
        sender: "CUSTOMER",
        body: "بدي ألغي الاشتراك",
        createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString()
      },
      {
        id: "msg_4",
        conversationId: "conv_2",
        sender: "SYSTEM",
        body: "تم اكتشاف طلب إلغاء. يفضل تحويل المحادثة لموظف.",
        createdAt: new Date(Date.now() - 1000 * 60 * 11).toISOString()
      }
    ]
  },
  {
    id: "conv_3",
    customerName: "لينا",
    customerPhone: "@lina.shop",
    channel: "INSTAGRAM",
    status: "HUMAN_ACTIVE",
    lastMessage: "في مشكلة بالربط مع إنستغرام",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    messages: [
      {
        id: "msg_5",
        conversationId: "conv_3",
        sender: "CUSTOMER",
        body: "في مشكلة بالربط مع إنستغرام",
        createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
      },
      {
        id: "msg_6",
        conversationId: "conv_3",
        sender: "HUMAN",
        body: "تمام، أنا معك. رح أراجع إعدادات الربط خطوة بخطوة.",
        createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString()
      }
    ]
  }
];

export const analyticsData = {
  conversationsToday: 184,
  aiResolved: 137,
  handoffs: 16,
  avgResponseTime: "3.9 ث",
  peakHours: [
    { hour: "10 ص", conversations: 18 },
    { hour: "12 م", conversations: 31 },
    { hour: "2 م", conversations: 22 },
    { hour: "6 م", conversations: 42 },
    { hour: "9 م", conversations: 35 }
  ],
  mostAsked: ["الأسعار", "طريقة الربط", "إنستغرام DM", "التحويل البشري"],
  channelMix: [
    { name: "واتساب", value: 68 },
    { name: "فيسبوك", value: 22 },
    { name: "إنستغرام", value: 10 }
  ]
};
