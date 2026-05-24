import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.com" },
    update: {},
    create: { email: "owner@demo.com", name: "Demo Owner" }
  });

  const business = await prisma.business.create({
    data: {
      ownerId: owner.id,
      name: "Amman Bistro",
      type: "Restaurant",
      mainLanguage: "Both",
      tone: "Jordanian Arabic",
      description: "A cozy restaurant serving shawarma, burgers, salads, and family meals.",
      openingHours: "Saturday to Thursday, 11 AM - 12 AM",
      location: "Amman, Jordan",
      deliveryAreas: "Amman, Sweifieh, Khalda, Abdoun",
      pricingNotes: "Delivery starts from 2 JOD.",
      returnRefundPolicy: "Refunds are handled by support for incorrect or missing orders.",
      whatsappConnection: {
        create: {
          provider: "MOCK",
          status: "DEMO_MODE",
          phoneNumber: "+962 79 000 0000",
          displayName: "Amman Bistro Demo"
        }
      },
      agent: {
        create: {
          name: "Mira",
          tone: "Jordanian Arabic",
          replyLanguage: "Both",
          knowledgeStrictness: "Balanced"
        }
      },
      products: {
        create: [
          { name: "Chicken Shawarma Meal", price: "3.50 JOD", available: true, description: "Served with fries, garlic sauce, and pickles." },
          { name: "Family Grill Box", price: "18 JOD", available: true, description: "Mixed grill box for four people." },
          { name: "Classic Burger", price: "4.25 JOD", available: true, description: "Beef patty, cheese, sauce, and fries." }
        ]
      },
      knowledgeItems: {
        create: [
          { type: "FAQ", title: "Do you deliver?", content: "Yes, delivery is available in Amman." },
          { type: "Policy", title: "Refunds", content: "Refund requests should be transferred to a human support agent." }
        ]
      },
      handoffRules: {
        create: [
          { label: "Angry customer", keywords: "angry,complaint,upset,bad service,غاضب,شكوى" },
          { label: "Refund or cancellation", keywords: "refund,cancel,return,استرجاع,الغاء" }
        ]
      },
      teamMembers: {
        create: [
          { email: "owner@demo.com", name: "Demo Owner", role: "OWNER" },
          { email: "support@demo.com", name: "Support Agent", role: "AGENT" }
        ]
      },
      subscription: {
        create: {
          plan: "Growth",
          status: "trialing"
        }
      }
    }
  });

  const conversation = await prisma.conversation.create({
    data: {
      businessId: business.id,
      customerName: "Sara",
      customerPhone: "+962 79 123 4567",
      status: "AI_HANDLING",
      lastMessage: "Do you deliver to Khalda?",
      messages: {
        create: [
          { sender: "CUSTOMER", body: "Hi, do you deliver to Khalda?" },
          { sender: "AI", body: "Yes, we deliver to Khalda. Delivery starts from 2 JOD. What would you like to order?" }
        ]
      }
    }
  });

  console.log(`Seeded ${business.name} with conversation ${conversation.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
