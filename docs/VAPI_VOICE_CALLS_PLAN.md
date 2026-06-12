# Vapi Voice Calls Implementation Plan

## الهدف

إضافة قناة مكالمات صوتية لمنصة الشات بوت SaaS بحيث يستطيع كل عميل تفعيل مساعد صوتي خاص به عبر Vapi، مع إبقاء مصدر الحقيقة داخل قاعدة بيانات المنصة: المنتجات، الأسعار، التوفر، السياسات، الطلبات، والتحويل البشري.

## القرار المعماري

Vapi يدير طبقة المكالمة فقط: الاتصال، الصوت، STT/TTS، أحداث المكالمة، والتحويل الهاتفي. Backend المنصة يدير كل الحقائق التجارية، tenant isolation، حفظ السجلات، والتحقق من النتائج.

لا نعتمد على `tenant_id` القادم من نموذج Vapi كدليل صلاحية. نستخدمه للبرومبت فقط، أما تحديد العميل الحقيقي فيتم من:

1. `vapi_call_id` إذا كانت المكالمة معروفة سابقا.
2. `assistant_id` المخزن في إعدادات العميل.
3. `phone_number_id` المخزن في إعدادات العميل.
4. `public_id` الخاص بإعدادات المكالمات في webhook URL.

## مراحل التنفيذ

### المرحلة 1: الأساس

- إضافة جداول المكالمات:
  - `vapi_call_settings`
  - `voice_calls`
  - `voice_call_events`
  - `voice_tool_calls`
  - `voice_leads`
- إضافة إعدادات env لـ Vapi:
  - `VAPI_API_KEY`
  - `VAPI_BASE_URL`
  - `VAPI_WEBHOOK_BEARER_TOKEN`
  - `VAPI_DEFAULT_ASSISTANT_ID`
- إضافة backend router:
  - `GET /api/calls/settings`
  - `PUT /api/calls/settings`
  - `GET /api/calls`
  - `GET /api/calls/{id}`
  - `POST /api/vapi/webhook/{public_id}`

### المرحلة 2: Webhook وTools

- استقبال أحداث Vapi:
  - `assistant-request`
  - `tool-calls`
  - `status-update`
  - `transcript`
  - `end-of-call-report`
- تنفيذ tools:
  - `search_products`
  - `get_product_details`
  - `check_availability`
  - `get_business_policy`
  - `create_order_or_lead`
  - `request_human_handoff`
  - `save_call_summary` كمسار احتياطي فقط، وليس المصدر الأساسي للحفظ.
- حفظ raw events وtool calls لأغراض audit/debug.
- idempotency حسب `toolCallId` حتى لا يتم إنشاء lead أو handoff مرتين.

### المرحلة 3: Prompt وAssistant

- بناء prompt قصير مناسب للمكالمات:
  - جمل قصيرة.
  - سؤال واحد كل مرة.
  - لا سعر أو توفر أو سياسة بدون tool result.
  - تأكيد الأرقام والطلب قبل الإنشاء.
  - تحويل بشري عند الشكوى أو الغضب أو طلب موظف أو عدم وضوح متكرر.
- دعم طريقتين:
  - Assistant واحد عام مع dynamic variables.
  - Assistant لكل tenant عند الحاجة لتخصيص عميق.

الافتراضي المقترح للـ MVP هو Assistant واحد عام مع إعدادات per-tenant في قاعدة البيانات.

### المرحلة 4: Dashboard

- صفحة إعدادات المكالمات:
  - تفعيل/تعطيل المكالمات.
  - رقم Vapi أو `phone_number_id`.
  - `assistant_id`.
  - اللهجة.
  - رقم التحويل البشري.
  - تفعيل التسجيل.
  - حالة الربط.
- صفحة سجل المكالمات:
  - المكالمات، transcript، الملخص، النتيجة، handoff، lead/order.

### المرحلة 5: Testing

- tenant isolation بين عميلين.
- سعر منتج موجود.
- منتج غير موجود.
- مقاس أو لون غير متوفر.
- أكثر من منتج مشابه.
- رقم هاتف غير واضح ثم تأكيد.
- طلب كامل ينشئ lead مرة واحدة فقط.
- غضب/شكوى تؤدي إلى handoff.
- `end-of-call-report` يحفظ transcript والملخص.
- webhook بدون authentication يفشل إذا كان token مضبوطا.
- timeout-safe path لـ `assistant-request`.

## System Prompt المقترح

```text
أنت مساعد صوتي لمتجر {{business_name}}.
تحدث بلهجة {{dialect}} وبأسلوب قصير وواضح مناسب للمكالمة.

قواعد الحقيقة:
- لا تذكر أي سعر إلا إذا رجع من أداة.
- لا تقل إن المنتج أو المقاس أو اللون متوفر إلا بعد check_availability.
- لا تخترع خصومات أو عروض أو مدة توصيل أو سياسة.
- إذا المعلومة غير موجودة قل: "المعلومة مش ظاهرة عندي حاليا، خليني أتأكدلك من الفريق".
- إذا ظهر أكثر من منتج محتمل، اسأل سؤال توضيحي واحد.

قواعد المكالمة:
- اسأل سؤالا واحدا كل مرة.
- عند أخذ رقم هاتف أو عنوان أو كمية أو مقاس أو لون، أعده على العميل واطلب التأكيد.
- قبل إنشاء الطلب، اقرأ ملخص الطلب كاملا وانتظر تأكيد العميل.
- عند الغضب أو الشكوى أو طلب موظف أو عدم فهم العميل مرتين، استدع request_human_handoff.

لا تقل إنك ذكاء اصطناعي إلا إذا سئلت مباشرة. عندها قل:
"أنا مساعد صوتي للمتجر، وبقدر أساعدك بالأسعار والطلبات".
```

## ملاحظات أمان

- كل tool يجب أن ينفذ باستخدام `user_id` المستنتج من قاعدة البيانات، وليس من arguments.
- يتم تخزين payloads الحساسة encrypted JSON حيث أمكن.
- raw events لا تستخدم كحقائق مباشرة للرد، بل كأرشيف.
- إنشاء الطلبات/الـ leads يحتاج تأكيد صريح داخل المحادثة.
- recording/transcript يحتاج رسالة إفصاح مناسبة حسب السوق والقوانين المحلية.
