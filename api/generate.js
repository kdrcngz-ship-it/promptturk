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
            # 1. Veriyi Al
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # 2. API Key Kontrolü
            api_key = os.environ.get("GOOGLE_API_KEY")
            if not api_key:
                raise Exception("Vercel'de GOOGLE_API_KEY ayarlı değil!")

            genai.configure(api_key=api_key)

            # 3. MODEL SEÇİMİ (DÜZELTİLDİ: gemini-2.5-flash)
            # Sen haklıydın, modelin adı tam olarak bu.
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            user_req = data.get('userRequest', '')
            category = data.get('category', 'Genel')
            
            # 4. Promptu Çak
            prompt = f"""
            Sen profesyonel bir Prompt Mühendisisin.
            Kullanıcı İsteği: {user_req}
            Kategori: {category}
            
            Görevin: Bu isteği en iyi sonucu verecek profesyonel bir AI promptuna dönüştür.
            Sadece promptu yaz, açıklama yapma.
            """

            # 5. İsteği Gönder
            response = model.generate_content(prompt)
            
            # 6. Cevabı Yaz
            response_data = json.dumps({"prompt": response.text})
            self.wfile.write(response_data.encode('utf-8'))

        except Exception as e:
            # Hata durumunda log bas ve cevabı dön
            error_msg = str(e)
            print(f"HATA: {error_msg}")
            self.wfile.write(json.dumps({"error": f"Hata: {error_msg}"}).encode('utf-8'))
