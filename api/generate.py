from http.server import BaseHTTPRequestHandler
import json
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
            # SENİN VERDİĞİN API KEY BURAYA GÖMÜLDÜ
            api_key = "AIzaSyC4P18pAnup5IC6NIbBgv1OT_5kqc5rQaE"

            genai.configure(api_key=api_key)
            
            # En stabil ve hızlı çalışan model budur. 
            # Eğer hata alırsan requirements.txt dosyasını güncellediğinden emin ol.
            model = genai.GenerativeModel('gemini-1.5-flash')

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            user_req = data.get('userRequest', '')
            category = data.get('category', 'Genel')
            
            prompt = f"""
            Sen uzman bir Prompt Mühendisisin.
            Kullanıcı isteği: {user_req}
            Kategori: {category}
            
            Görevin: Bu isteği, seçilen yapay zeka için mükemmel ve detaylı bir prompta dönüştür.
            Sadece oluşturduğun promptu yaz, başına sonuna açıklama ekleme.
            """

            response = model.generate_content(prompt)
            self.wfile.write(json.dumps({"prompt": response.text}).encode('utf-8'))

        except Exception as e:
            self.wfile.write(json.dumps({"error": f"Hata: {str(e)}"}).encode('utf-8'))
