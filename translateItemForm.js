const fs = require('fs');

const file = 'C:/Users/GTX/OneDrive/Documents/Ai projects/va-dev/frontend/src/components/ItemForm.jsx';
let content = fs.readFileSync(file, 'utf8');

const arPath = 'C:/Users/GTX/OneDrive/Documents/Ai projects/va-dev/frontend/src/locales/ar.json';
const enPath = 'C:/Users/GTX/OneDrive/Documents/Ai projects/va-dev/frontend/src/locales/en.json';
const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const translations = {
  "item_save_error": ["تعذر حفظ العنصر", "Could not save the item"],
  "image_upload_fail": ["فشل رفع الصورة", "Failed to upload image"],
  "option_add_fail": ["فشل إضافة الخيار", "Failed to add option"],
  "edit_item": ["تعديل العنصر", "Edit item"],
  "add_new_item": ["إضافة عنصر جديد", "Add new item"],
  "name_required": ["الاسم *", "Name *"],
  "description_extra": ["الوصف / معلومات إضافية", "Description / Additional information"],
  "category": ["التصنيف", "Category"],
  "price": ["السعر", "Price"],
  "currency": ["العملة", "Currency"],
  "stock": ["📦 المخزون", "📦 Stock"],
  "quantity_blank": ["الكمية (اتركه فارغ = غير محدد)", "Quantity (leave blank = unspecified)"],
  "stock_status": ["حالة المخزون", "Stock status"],
  "in_stock": ["متوفر", "Available"],
  "out_of_stock": ["غير متوفر", "Out of stock"],
  "preorder": ["طلب مسبق", "Preorder"],
  "coming_soon": ["قريباً", "Coming soon"],
  "warranty_section": ["🛡️ الكفالة / الضمان", "🛡️ Warranty / Guarantee"],
  "warranty_duration": ["مدة الكفالة", "Warranty duration"],
  "warranty_duration_ph": ["مثل: سنة، 6 أشهر، بدون كفالة", "e.g., 1 year, 6 months, no warranty"],
  "warranty_terms": ["شروط الكفالة", "Warranty terms"],
  "warranty_terms_ph": ["مثل: تغطي عيوب التصنيع فقط", "e.g., covers manufacturing defects only"],
  "warranty_coverage": ["ما تشمله الكفالة", "What the warranty covers"],
  "warranty_coverage_ph": ["مثل: الشاشة، البطارية، عيوب التصنيع", "e.g., screen, battery, manufacturing defects"],
  "warranty_exclusions": ["ما لا تشمله الكفالة", "What the warranty does not cover"],
  "warranty_exclusions_ph": ["مثل: الكسر، دخول الماء، سوء الاستخدام", "e.g., breakage, water damage, misuse"],
  "options_section": ["🎨 الخيارات (ألوان / مقاسات / موديلات)", "🎨 Options (colors / sizes / models)"],
  "type": ["النوع", "Type"],
  "select": ["اختر…", "Select..."],
  "color": ["لون", "Color"],
  "size": ["مقاس", "Size"],
  "flavor": ["نكهة", "Flavor"],
  "model": ["موديل", "Model"],
  "material": ["خامة", "Material"],
  "edition": ["نسخة", "Edition"],
  "value": ["القيمة", "Value"],
  "value_ph": ["مثل: أسود، L، فانيلا", "e.g., Black, L, Vanilla"],
  "diff_price": ["سعر مختلف", "Different price"],
  "optional": ["اختياري", "Optional"],
  "add_btn": ["+ إضافة", "+ Add"],
  "save_item_first": ["احفظ العنصر أولاً ثم عدّله لإضافة الخيارات.", "Save the item first, then edit it to add options."],
  "extra_details": ["تفاصيل إضافية", "Additional details"],
  "add_field": ["+ إضافة حقل", "+ Add field"],
  "title_ph": ["العنوان (مثل: اللون)", "Title (e.g., Color)"],
  "value_placeholder": ["القيمة", "Value"],
  "product_image": ["صورة المنتج", "Product image"],
  "saving": ["جاري الحفظ…", "Saving..."],
  "save": ["حفظ", "Save"],
  "cancel": ["إلغاء", "Cancel"],
  "save_item_first_image": ["احفظ العنصر أولاً، ثم عدّله لرفع صورة وإضافة خيارات.", "Save the item first, then edit it to upload an image and add options."]
};

for (const [key, [ar, en]] of Object.entries(translations)) {
  arData[key] = ar;
  enData[key] = en;
}

fs.writeFileSync(arPath, JSON.stringify(arData, null, 2));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));

// Insert useTranslation
if (!content.includes('useTranslation')) {
  content = content.replace('import { API_BASE }', 'import { useTranslation } from "react-i18next";\nimport { API_BASE }');
}

// Add const { t } = useTranslation();
if (!content.includes('const { t } = useTranslation();')) {
  content = content.replace('export default function ItemForm({ initial, onSubmit, onCancel, onImageUpload }) {', 'export default function ItemForm({ initial, onSubmit, onCancel, onImageUpload }) {\n  const { t } = useTranslation();');
}

// update dir="rtl" to dir={t('dir', 'ltr')}
content = content.replace(/dir="rtl"/g, "dir={t('dir', 'ltr')}");

const replaceMap = [
  ['"تعذر حفظ العنصر"', 't("item_save_error")'],
  ['"فشل رفع الصورة"', 't("image_upload_fail")'],
  ['"فشل إضافة الخيار"', 't("option_add_fail")'],
  ['"تعديل العنصر" : "إضافة عنصر جديد"', 't("edit_item") : t("add_new_item")'],
  ['الاسم *', '{t("name_required")}'],
  ['الوصف / معلومات إضافية', '{t("description_extra")}'],
  ['التصنيف', '{t("category")}'],
  ['السعر', '{t("price")}'],
  ['العملة', '{t("currency")}'],
  ['>متوفر<', '>{t("in_stock")}<'],
  ['📦 المخزون', '{t("stock")}'],
  ['الكمية (اتركه فارغ = غير محدد)', '{t("quantity_blank")}'],
  ['حالة المخزون', '{t("stock_status")}'],
  ['>متوفر<', '>{t("in_stock")}<'],
  ['>غير متوفر<', '>{t("out_of_stock")}<'],
  ['>طلب مسبق<', '>{t("preorder")}<'],
  ['>قريباً<', '>{t("coming_soon")}<'],
  ['🛡️ الكفالة / الضمان', '{t("warranty_section")}'],
  ['مدة الكفالة', '{t("warranty_duration")}'],
  ['"مثل: سنة، 6 أشهر، بدون كفالة"', 't("warranty_duration_ph")'],
  ['شروط الكفالة', '{t("warranty_terms")}'],
  ['"مثل: تغطي عيوب التصنيع فقط"', 't("warranty_terms_ph")'],
  ['ما تشمله الكفالة', '{t("warranty_coverage")}'],
  ['"مثل: الشاشة، البطارية، عيوب التصنيع"', 't("warranty_coverage_ph")'],
  ['ما لا تشمله الكفالة', '{t("warranty_exclusions")}'],
  ['"مثل: الكسر، دخول الماء، سوء الاستخدام"', 't("warranty_exclusions_ph")'],
  ['🎨 الخيارات (ألوان / مقاسات / موديلات)', '{t("options_section")}'],
  ['النوع', '{t("type")}'],
  ['>اختر…<', '>{t("select")}<'],
  ['>لون<', '>{t("color")}<'],
  ['>مقاس<', '>{t("size")}<'],
  ['>نكهة<', '>{t("flavor")}<'],
  ['>موديل<', '>{t("model")}<'],
  ['>خامة<', '>{t("material")}<'],
  ['>نسخة<', '>{t("edition")}<'],
  ['القيمة', '{t("value")}'],
  ['"مثل: أسود، L، فانيلا"', 't("value_ph")'],
  ['سعر مختلف', '{t("diff_price")}'],
  ['"اختياري"', 't("optional")'],
  ['+ إضافة', '{t("add_btn")}'],
  ['احفظ العنصر أولاً ثم عدّله لإضافة الخيارات.', '{t("save_item_first")}'],
  ['تفاصيل إضافية', '{t("extra_details")}'],
  ['+ إضافة حقل', '{t("add_field")}'],
  ['"العنوان (مثل: اللون)"', 't("title_ph")'],
  ['"القيمة"', 't("value_placeholder")'],
  ['صورة المنتج', '{t("product_image")}'],
  ['"جاري الحفظ…" : "حفظ"', 't("saving") : t("save")'],
  ['إلغاء', '{t("cancel")}'],
  ['احفظ العنصر أولاً، ثم عدّله لرفع صورة وإضافة خيارات.', '{t("save_item_first_image")}']
];

for (const [search, replace] of replaceMap) {
  content = content.replace(search, replace);
}

// Special case for 'متوفر' inside the label
content = content.replace('متوفر\n        </label>', '{t("in_stock")}\n        </label>');

fs.writeFileSync(file, content);
