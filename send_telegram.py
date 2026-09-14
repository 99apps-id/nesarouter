import os
import urllib.request
import json

token = os.environ.get("TELEGRAM_BOT_TOKEN")
chat_id = "450913223"
file_path = r"C:\project\nesarouter\NPWP CV. STAR JAYA ABADI.pdf"

if not token:
    print("ERROR: TELEGRAM_BOT_TOKEN not set")
    exit(1)

url = f"https://api.telegram.org/bot{token}/sendDocument"

boundary = "----FormBoundary7MA4YWxkTrZu0gW"
file_name = os.path.basename(file_path)

with open(file_path, "rb") as f:
    file_data = f.read()

body = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="chat_id"\r\n\r\n'
    f"{chat_id}\r\n"
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="caption"\r\n\r\n'
    f"NPWP CV. STAR JAYA ABADI\r\n"
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="document"; filename="{file_name}"\r\n'
    f"Content-Type: application/pdf\r\n\r\n"
).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

req = urllib.request.Request(url, data=body, method="POST")
req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        print(json.dumps(result, indent=2))
except Exception as e:
    print(f"ERROR: {e}")
