import fs from 'fs';

async function translateText(text) {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`);
    const data = await res.json();
    return data.responseData.translatedText;
  } catch(e) {
    console.error('Translation failed for', text);
    return text;
  }
}

async function run() {
  const extracted = JSON.parse(fs.readFileSync('extracted.json', 'utf8'));
  const map = {};
  
  // Rate limits might be hit, so we add a delay
  for (let i = 0; i < extracted.length; i++) {
    const text = extracted[i];
    console.log(`Translating ${i+1}/${extracted.length}...`);
    // Basic hardcoded fixes to avoid bad API translations
    if(text === "متوفر") { map[text] = "Available"; continue; }
    if(text === "غير متوفر") { map[text] = "Out of stock"; continue; }
    if(text === "حفظ") { map[text] = "Save"; continue; }
    if(text === "إلغاء") { map[text] = "Cancel"; continue; }
    if(text === "تعديل") { map[text] = "Edit"; continue; }
    if(text === "حذف") { map[text] = "Delete"; continue; }
    
    let en = await translateText(text);
    // fallback if API limits
    if (!en || en.includes('MYMEMORY WARNING')) {
      en = "Translation_" + i;
    }
    map[text] = en;
    await new Promise(r => setTimeout(r, 300));
  }
  
  fs.writeFileSync('map.json', JSON.stringify(map, null, 2));
  console.log('Done mapping.');
}
run();
