from http.server import BaseHTTPRequestHandler
import json
import os
from openai import OpenAI

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        try:
            # ARTIK ŞİFRE BURADA DEĞİL!
            # Kod, Vercel'in ayarlarından (Environment Variables) okuyacak.
            api_key = os.environ.get("OPENAI_API_KEY")

            if not api_key:
                self.wfile.write(json.dumps({"error": "API Key bulunamadı! Vercel ayarlarını kontrol et."}).encode('utf-8'))
                return

            client = OpenAI(api_key=api_key)

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            user_req = data.get('userRequest', '')
            category = data.get('category', 'Genel')
            language = data.get('language', 'tr')

            system_msg = f"Sen uzman bir Prompt Mühendisisin. Görevin, kullanıcı isteğini TAMAMEN {language} dilinde profesyonel bir yapay zeka promptuna dönüştürmektir. Sadece promptu yaz, açıklama yapma."
            user_msg = f"Kategori: {category}. İstek: {user_req}"

            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg}
                ]
            )

            response_text = completion.choices[0].message.content
            self.wfile.write(json.dumps({"prompt": response_text}).encode('utf-8'))

        except Exception as e:
            self.wfile.write(json.dumps({"error": f"Hata: {str(e)}"}).encode('utf-8'))
