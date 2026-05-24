import urllib.request
import urllib.parse
import json
import time

BASE_URL = "https://masarjo.com/api"
timestamp = int(time.time())
EMAIL = f"test_{timestamp}@example.com"
USERNAME = f"user_{timestamp}"
PASSWORD = "Password123!"

def make_request(method, path, data=None, token=None, form_encoded=False):
    url = BASE_URL + path
    headers = {}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    encoded_data = None
    if data:
        if form_encoded:
            encoded_data = urllib.parse.urlencode(data).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            encoded_data = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

print("=== 1. Registering user ===")
status, data = make_request("POST", "/auth/register", {
    "email": EMAIL,
    "username": USERNAME,
    "password": PASSWORD,
    "business_name": "Test Business"
})
print(f"Status: {status}, Response: {data}")
token = data.get("access_token")

print("\n=== 2. Creating a Product (Item) ===")
status, data = make_request("POST", "/items", {
    "name": "Test Product",
    "price": 99.99,
    "description": "A great product",
    "category": "Electronics"
}, token=token)
print(f"Status: {status}, Response: {data}")

print("\n=== 3. Listing Products ===")
status, data = make_request("GET", "/items", token=token)
print(f"Status: {status}, Items count: {len(data) if isinstance(data, list) else data}")

print("\n=== 4. Adding Knowledge (Policy) ===")
status, data = make_request("POST", "/policies", {
    "title": "Return Policy",
    "content": "30 days return",
    "policy_type": "refund",
    "is_active": True
}, token=token)
print(f"Status: {status}, Response: {data}")

print("\n=== 5. Listing Knowledge ===")
status, data = make_request("GET", "/policies", token=token)
print(f"Status: {status}, Policies count: {len(data) if isinstance(data, list) else data}")

print("\n=== 6. Testing Agent (Chat) ===")
status, data = make_request("POST", "/chat/send", {"message": "Hello!"}, token=token, form_encoded=True)
print(f"Status: {status}, Response: {data}")

print("\n=== 7. Creating a Handoff ===")
if data.get("session_id"):
    session_id = data.get("session_id")
    status, data = make_request("POST", "/handoff/", {
        "session_id": session_id,
        "reason": "Customer needs help",
        "priority": "normal"
    }, token=token)
    print(f"Status: {status}, Response: {data}")

print("\n=== 8. Listing Handoffs ===")
status, data = make_request("GET", "/handoff/", token=token)
print(f"Status: {status}, Handoffs count: {len(data) if isinstance(data, list) else data}")
