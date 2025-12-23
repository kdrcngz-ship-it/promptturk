export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        const { category, categoryName, userRequest, targetAI, language } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı eksik!");

        // AYAR BURADA: Yapay zekaya "Cevap verme, Prompt yaz" diye bağırıyoruz
        const engineeringPrompt = `
            GÖREVİN: Sen bir PROMPT MÜHENDİSİSİN.
            
            KULLANICI NE İSTİYOR: "${userRequest}"
            HEDEF AI: ${targetAI}
            KATEGORİ: ${categoryName}

            KURALLAR (KESİN UY):
            1. ASLA kullanıcının isteğini yerine getirme! (Örn: "Şiir yaz" derse şiir yazma, şiir yazdıracak komutu yaz).
            2. Çıktın SADECE ve SADECE oluşturulacak prompt metni olmalı.
            3. Sohbet etme, "Merhaba" deme, "İşte promptun" deme. Sadece metni ver.
            4. Promptu şu formatta yaz: "Sen uzman bir [Rol]sun. [Görev] hakkında detaylı bilgi ver..."
            5. ${language === 'en' ? 'Write the prompt in English.' : 'Prompt Türkçe olsun.'}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: engineeringPrompt }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error?.message || "Model Hatası");

        const resultText = data.candidates[0].content.parts[0].text;
        
        return res.status(200).json({ 
            prompt: resultText, 
            result: resultText, 
            provider: 'gemini-2.5-flash' 
        });

    } catch (error) {
        return res.status(200).json({ 
            prompt: "⚠️ Hata: " + error.message,
            result: "⚠️ Hata: " + error.message,
            provider: 'error'
        });
    }
}
