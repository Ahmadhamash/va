import json
import urllib.request
import urllib.parse
import time

def translate(text):
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=" + urllib.parse.quote(text)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return "".join([x[0] for x in data[0]])
    except Exception as e:
        print("Error translating:", text)
        return text

def run():
    with open('extracted.json', 'r', encoding='utf-8') as f:
        extracted = json.load(f)
    
    result_map = {}
    print(f"Translating {len(extracted)} strings...")
    for i, text in enumerate(extracted):
        print(f"Translating {i+1}/{len(extracted)}...")
        en = translate(text)
        result_map[text] = en
        time.sleep(0.1)
        
    with open('map.json', 'w', encoding='utf-8') as f:
        json.dump(result_map, f, ensure_ascii=False, indent=2)
    print("Done!")

if __name__ == '__main__':
    run()
