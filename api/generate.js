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
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            api_key = os.environ.get("GOOGLE_API_KEY")
            if not api_key:
                raise Exception("GOOGLE_API_KEY ayarlı değil!")

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')

            user_req = data.get('userRequest', '')
            category = data.get('category', 'Genel')

            prompt = f"""
            Sen profesyonel bir Prompt Mühendisisin.
            Kullanıcı İsteği: {user_req}
            Kategori: {category}
            
            Görevin: Bu isteği en iyi sonucu verecek profesyonel bir AI promptuna dönüştür.
            Sadece promptu yaz, açıklama yapma.
            """

            response = model.generate_content(prompt)
            response_data = json.dumps({"prompt": response.text})
            self.wfile.write(response_data.encode('utf-8'))

        except Exception as e:
            error_msg = str(e)
            self.wfile.write(json.dumps({"error": f"Hata: {error_msg}"}).encode('utf-8'))
