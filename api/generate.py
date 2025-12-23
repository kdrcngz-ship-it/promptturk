from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

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
            # ---------------------------------------------------------
            # BURAYA DİKKAT! Tırnakların içine AIza ile başlayan keyini yapıştır.
            # Örnek: api_key = "AIzaSyBd7..." 
            api_key = "AIzaSyC4P18pAnup5IC6NIbBgv1OT_5kqc5rQaE"
            # ---------------------------------------------------------

            if "BURAYA" in api_key or not api_key:
                self.wfile.write(json.dumps({"error": "Kodun içine API Key yapıştırmayı unuttun!"}).encode('utf-8'))
                return

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            prompt = f"Kullanıcı isteği: {data.get('userRequest', '')}. Kategori: {data.get('category', 'Genel')}. Bunu profesyonel bir prompta çevir."

            response = model.generate_content(prompt)
            self.wfile.write(json.dumps({"prompt": response.text}).encode('utf-8'))

        except Exception as e:
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
