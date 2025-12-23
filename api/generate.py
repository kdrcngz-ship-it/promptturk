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
            # SENİN API KEY
            api_key = "AIzaSyC4P18pAnup5IC6NIbBgv1OT_5kqc5rQaE"

            genai.configure(api_key=api_key)
            
            # DEĞİŞİKLİK BURADA: 'gemini-pro'
            # Bu model her sürümde çalışır, naz yapmaz, hata vermez.
            model = genai.GenerativeModel('gemini-pro')

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            user_req = data.get('userRequest', '')
            category = data.get('category', 'Genel')
            language = data.get('language', 'tr')
            
            prompt = f"""
            Sen uzman bir Prompt Mühendisisin.
            
            Kullanıcı İsteği: {user_req}
            Kategori: {category}
            Hedef Dil: {language} (Eğer 'tr' ise Türkçe, 'en' ise İngilizce yaz)
            
            Görevin: Bu isteği, TAMAMEN {language} dilinde profesyonel bir yapay zeka promptuna dönüştür.
            Cevabın kesinlikle {language} dilinde olsun.
            Sadece promptu yaz, açıklama yapma.
            """

            response = model.generate_content(prompt)
            self.wfile.write(json.dumps({"prompt": response.text}).encode('utf-8'))

        except Exception as e:
            self.wfile.write(json.dumps({"error": f"Hata: {str(e)}"}).encode('utf-8'))
