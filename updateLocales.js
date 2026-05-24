const fs = require('fs');

const arPath = './frontend/src/locales/ar.json';
const enPath = './frontend/src/locales/en.json';

const newEn = {
  "available": "Available",
  "out_of_stock": "Out of stock",
  "preorder": "Preorder",
  "coming_soon": "Coming soon",
  "unavailable": "Unavailable",
  "no_price": "No price",
  "quantity": "Quantity:",
  "option": "Option",
  "options": "Options",
  "edit": "Edit",
  "disable": "Disable",
  "enable": "Enable",
  "delete": "Delete"
};

const newAr = {
  "available": "متوفر",
  "out_of_stock": "غير متوفر",
  "preorder": "طلب مسبق",
  "coming_soon": "قريباً",
  "unavailable": "غير متوفر",
  "no_price": "بدون سعر",
  "quantity": "الكمية:",
  "option": "خيار",
  "options": "خيارات",
  "edit": "تعديل",
  "disable": "إيقاف",
  "enable": "تفعيل",
  "delete": "حذف"
};

function updateLocales() {
  const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  Object.assign(arData, newAr);
  Object.assign(enData, newEn);

  fs.writeFileSync(arPath, JSON.stringify(arData, null, 2));
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
}

updateLocales();
