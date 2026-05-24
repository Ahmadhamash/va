import json
from deep_translator import GoogleTranslator

def run():
    with open('extracted.json', 'r', encoding='utf-8') as f:
        extracted = json.load(f)
    
    translator = GoogleTranslator(source='ar', target='en')
    result_map = {}
    
    print(f"Translating {len(extracted)} strings...")
    for i, text in enumerate(extracted):
        try:
            translation = translator.translate(text)
            result_map[text] = translation
        except Exception as e:
            result_map[text] = "Translation_" + str(i)
            
    with open('map.json', 'w', encoding='utf-8') as f:
        json.dump(result_map, f, ensure_ascii=False, indent=2)
    print("Done!")

if __name__ == '__main__':
    run()
