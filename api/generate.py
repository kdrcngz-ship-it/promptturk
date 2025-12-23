from http.server import BaseHTTPRequestHandler
import json
import urllib.request
import os

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
            # SENİN API KEY
            api_key = "AIzaSyC4P18pAnup5IC6NIbBgv1OT_5kqc5rQaE"
            
            # OKU
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            user_req = data.get('userRequest', '')
            category = data.get('category', 'Genel')
            language = data.get('language', 'tr')

            # PROMPT HAZIRLA
            final_prompt = f"""
            Sen uzman bir Prompt Mühendisisin.
            Kullanıcı İsteği: {user_req}
            Kategori: {category}
            Hedef Dil: {language}
            
            Görevin: Bu isteği, TAMAMEN {language} dilinde profesyonel bir yapay zeka promptuna dönüştür.
            Sadece promptu yaz, açıklama yapma.
            """

            # BURASI ÖNEMLİ: Kütüphane kullanmadan direkt Google'ın kapısını çalıyoruz.
            # Model: gemini-1.5-flash (En hızlı ve kotası bol olan)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            
            headers = {'Content-Type': 'application/json'}
            body = {
                "contents": [{
                    "parts": [{"text": final_prompt}]
                }]
            }
            
            # İsteği gönder (Python'un kendi aracıyla)
            req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers, method='POST')
            
            with urllib.request.urlopen(req) as response:
                res_body = response.read()
                res_json = json.loads(res_body)
                # Cevabı ayıkla
                generated_text = res_json['candidates'][0]['content']['parts'][0]['text']
                
                self.wfile.write(json.dumps({"prompt": generated_text}).encode('utf-8'))

        except Exception as e:
            # Hata olursa ne olduğunu görelim
            self.wfile.write(json.dumps({"error": f"Hata: {str(e)}"}).encode('utf-8'))
