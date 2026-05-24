import os
import re

FRONTEND_DIR = r"c:\Users\GTX\OneDrive\Documents\Ai projects\va-deploy-server\frontend\src"

def analyze():
    files = []
    for root, _, filenames in os.walk(FRONTEND_DIR):
        for name in filenames:
            if name.endswith('.jsx') or name.endswith('.js'):
                files.append(os.path.join(root, name))

    routes = set()
    links = []
    a_tags = []
    api_calls = []
    
    # regexes
    route_re = re.compile(r'<Route\s+path=["\']([^"\']+)["\']')
    link_re = re.compile(r'<Link[^>]+to=["\']([^"\']+)["\']')
    a_tag_re = re.compile(r'<a[^>]+href=["\']([^"\']+)["\']')
    api_re = re.compile(r'api\.(get|post|put|delete|patch)\([\'"]([^\'"]+)[\'"]')

    for fpath in files:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
            rel_path = os.path.relpath(fpath, FRONTEND_DIR)
            
            # find routes (mostly in App.jsx)
            for match in route_re.findall(content):
                routes.add(match)
            
            # find links
            for match in link_re.findall(content):
                links.append((rel_path, match))
                
            # find a tags
            for match in a_tag_re.findall(content):
                a_tags.append((rel_path, match))
                
            # find api calls
            for method, endpoint in api_re.findall(content):
                api_calls.append((rel_path, method, endpoint))
                
    with open('audit_results.txt', 'w', encoding='utf-8') as out:
        out.write("=== ROUTES DEFINED ===\n")
        for r in sorted(routes):
            out.write(f"{r}\n")
            
        out.write("\n=== LINKS FOUND ===\n")
        for f, l in links:
            out.write(f"{f}: {l}\n")
            
        out.write("\n=== A TAGS FOUND ===\n")
        for f, a in a_tags:
            out.write(f"{f}: {a}\n")
            
        out.write("\n=== API CALLS ===\n")
        for f, m, e in api_calls:
            out.write(f"{f}: {m} {e}\n")

if __name__ == "__main__":
    analyze()
